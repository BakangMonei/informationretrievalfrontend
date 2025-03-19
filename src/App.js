import { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import Slider from 'react-slick';
import {
  Search,
  Upload,
  Database,
  RefreshCw,
  FileUp,
  AlertCircle,
  ChevronRight,
  BarChart,
  Settings,
  Loader
} from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const API_BASE_URL = 'http://localhost:8080/api';

// Configure axios with the correct base URL and defaults
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.timeout = 5000; // 5 seconds timeout

// Add axios interceptors for better error handling
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ERR_NETWORK') {
      toast.error(
        <div>
          <strong>Cannot connect to server</strong>
          <p className="text-sm">Make sure the Spring backend is running on port 8080</p>
        </div>
      );
    } else if (error.response?.status === 500) {
      const errorMessage = error.response?.data?.message || 'An internal server error occurred';
      console.error('Server Error:', error.response?.data);
      toast.error(
        <div>
          <strong>Server Error</strong>
          <p className="text-sm">{errorMessage}</p>
        </div>
      );
    } else if (error.response?.status === 404) {
      toast.error(
        <div>
          <strong>Not Found</strong>
          <p className="text-sm">The requested resource was not found</p>
        </div>
      );
    }
    return Promise.reject(error);
  }
);

/**
 * @fileoverview Main application component for the Information Retrieval System
 * @module App
 */

/**
 * @typedef {Object} SearchConfig
 * @property {string} tokenizerType - The type of tokenizer to use ('standard' or 'custom')
 * @property {boolean} useStemming - Whether to enable stemming
 * @property {string} rankingAlgorithm - The ranking algorithm to use ('tf-idf' or 'tf')
 * @property {boolean} lengthNormalization - Whether to enable length normalization
 */

/**
 * @typedef {Object} LoadingState
 * @property {boolean} search - Loading state for search operations
 * @property {boolean} upload - Loading state for upload operations
 * @property {boolean} import - Loading state for import operations
 * @property {boolean} recreate - Loading state for index recreation
 */

/**
 * Main Application Component
 * Provides document search, upload, and index management functionality
 * @component
 * @returns {JSX.Element} The rendered application
 */
function App() {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [indexStats, setIndexStats] = useState(null);
  const [indexMetrics, setIndexMetrics] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState({
    search: false,
    upload: false,
    import: false,
    recreate: false
  });
  const [serverStatus, setServerStatus] = useState('checking');

  // Index Configuration States
  const [config, setConfig] = useState({
    normalization: {},
    ranking: {},
    stemming: {},
    tokenizer: {}
  });

  // Add these state variables after the existing useState declarations
  const [searchConfig, setSearchConfig] = useState({
    tokenizerType: 'standard', // or 'custom'
    useStemming: false,
    rankingAlgorithm: 'tf-idf', // or 'tf'
    lengthNormalization: true
  });

  // Add new state for dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => { },
  });

  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: false
  };

  /**
   * Checks the API server availability
   * @async
   * @returns {Promise<void>}
   */
  const checkApiAvailability = async () => {
    try {
      await axios.get('/index/stats');
    } catch (error) {
      toast.error(
        'Unable to connect to the API. Please check if the server is running.',
        {
          duration: 5000,
          position: 'top-center',
        }
      );
    }
  };

  const checkServerConnection = async () => {
    try {
      const response = await axios.get('/index/stats');
      setServerStatus('connected');
      return true;
    } catch (error) {
      setServerStatus('disconnected');
      console.error('Connection error:', error);
      return false;
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      const isConnected = await checkServerConnection();
      if (isConnected) {
        await fetchInitialData();
      }
    };

    initializeApp();
  }, []);

  const fetchInitialData = async () => {
    toast.promise(
      Promise.all([
        fetchIndexStats(),
        fetchIndexMetrics(),
        fetchConfig()
      ]),
      {
        loading: 'Loading initial data...',
        success: 'Data loaded successfully',
        error: 'Some data could not be loaded'
      }
    );
  };

  const fetchConfig = async () => {
    try {
      const endpoints = [
        'normalization',
        'ranking',
        'stemming',
        'tokenizer'
      ];

      // Add retry logic
      const fetchWithRetry = async (endpoint, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await axios.get(`/index/config/${endpoint}`);
            return response;
          } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      };

      const results = await Promise.allSettled(
        endpoints.map(endpoint => fetchWithRetry(endpoint))
      );

      const newConfig = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          newConfig[endpoints[index]] = result.value.data;
        } else {
          newConfig[endpoints[index]] = null;
          console.warn(`Failed to load ${endpoints[index]} config after retries`);
        }
      });

      setConfig(newConfig);
    } catch (error) {
      console.warn('Error fetching configurations:', error);
    }
  };

  const fetchIndexStats = async () => {
    try {
      const response = await axios.get('/index/stats');
      setIndexStats(response.data);
    } catch (error) {
      console.warn('Error fetching index stats:', error);
      setIndexStats(null);
      // Don't show error toast as this is handled by the parent promise
    }
  };

  const fetchIndexMetrics = async () => {
    try {
      const response = await axios.get('/index/metrics');
      setIndexMetrics(response.data);
    } catch (error) {
      console.warn('Error fetching metrics:', error);
      setIndexMetrics(null);
      // Don't show error toast as this is handled by the parent promise
    }
  };

  /**
   * Handles document search
   * @async
   * @param {React.FormEvent} e - Form submission event
   * @returns {Promise<void>}
   */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(prev => ({ ...prev, search: true }));
    try {
      const response = await axios.post('/documents/search', {
        query: searchQuery.trim(),
        tokenizerType: searchConfig.tokenizerType,
        useStemming: searchConfig.useStemming,
        rankingAlgorithm: searchConfig.rankingAlgorithm,
        applyLengthNormalization: searchConfig.lengthNormalization,
        resultsPerPage: 10,
        page: 0
      });

      if (response.data) {
        const {
          results,
          totalHits,
          queryTime,
          metrics: {
            precision,
            recall,
            f1Score,
            tokenizationTime,
            rankingTime,
            numberOfTokens,
            averageDocumentLength,
            vocabularySize
          }
        } = response.data;

        setDocuments(results || []);
        setIndexMetrics({
          precision: precision?.toFixed(3) || 0,
          recall: recall?.toFixed(3) || 0,
          f1Score: f1Score?.toFixed(3) || 0,
          queryTime,
          totalHits,
          tokenizationTime,
          rankingTime,
          numberOfTokens,
          averageDocumentLength,
          vocabularySize
        });

        toast.success(`Found ${totalHits} results in ${queryTime}ms`);
      } else {
        setDocuments([]);
        toast.info('No results found');
      }
    } catch (error) {
      console.error('Search error:', error);
      setDocuments([]);
      toast.error('Error performing search');
    } finally {
      setLoading(prev => ({ ...prev, search: false }));
    }
  };

  /**
   * Handles file upload selection
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event
   * @returns {void}
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];

    // Update allowed types to include XML
    const allowedTypes = [
      'text/plain',
      'application/json',
      'text/csv',
      'text/xml',
      'application/xml',
      '.xml'  // For PubMed XML files
    ];
    const maxSize = 1000 * 2048 * 2048; // Increased to 100MB for larger XML files

    if (!file) {
      toast.error('Please select a file');
      return;
    }

    // Check file extension for XML files specifically
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const isAllowedType = allowedTypes.includes(file.type) ||
      allowedTypes.includes(`.${fileExtension}`);

    if (!isAllowedType) {
      toast.error('Invalid file type. Please upload a .txt, .json, .csv, or .xml file');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File is too large. Maximum size is 100MB');
      return;
    }

    // Add file type detection
    const fileType = fileExtension === 'xml' ? 'pubmed' : 'standard';

    setSelectedFile({
      file,
      type: fileType
    });

    toast.success(`Selected ${fileType.toUpperCase()} file: ${file.name}`);
  };

  /**
   * Handles bulk document upload
   * @async
   * @returns {Promise<void>}
   */
  const handleBulkUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(prev => ({ ...prev, upload: true }));
    const formData = new FormData();
    formData.append('file', selectedFile.file);

    // Add configuration parameters
    formData.append('tokenizerType', searchConfig.tokenizerType);
    formData.append('useStemming', searchConfig.useStemming);
    formData.append('rankingAlgorithm', searchConfig.rankingAlgorithm);
    formData.append('lengthNormalization', searchConfig.lengthNormalization);

    try {
      const uploadResponse = await axios.post('/documents/bulk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000 // 5 minutes
      });

      if (uploadResponse.data) {
        const metrics = uploadResponse.data;

        // Update metrics display
        setIndexMetrics(prev => ({
          ...prev,
          documentCount: metrics.totalDocuments,
          tokenCount: metrics.totalTokens,
          uniqueTokenCount: metrics.uniqueTokens,
          processingTime: metrics.processingTime,
          averageDocumentLength: metrics.averageDocLength,
          precision: metrics.precision,
          recall: metrics.recall,
          f1Score: metrics.f1Score,
          datasetType: metrics.datasetType
        }));

        toast.success(`Processed ${metrics.totalDocuments} documents with ${metrics.uniqueTokens} unique tokens`);
        await fetchIndexStats();
      }

    } catch (error) {
      console.error('Upload Error Details:', error);
      toast.error(error.response?.data?.message || 'Error processing documents');
    } finally {
      setLoading(prev => ({ ...prev, upload: false }));
      setSelectedFile(null);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    }
  };

  // Add this helper function to check file format
  const isValidFileFormat = (content) => {
    try {
      // Try parsing as JSON
      JSON.parse(content);
      return true;
    } catch (e) {
      // Check if it's CSV format (simple check)
      const lines = content.split('\n');
      if (lines.length > 1) {
        const headerCount = lines[0].split(',').length;
        return lines.every(line => line.split(',').length === headerCount);
      }
      // Assume it's valid text format
      return true;
    }
  };

  /**
   * Imports a specific dataset type
   * @async
   * @param {('cisi'|'pubmed')} type - The type of dataset to import
   * @returns {Promise<void>}
   */
  const handleImport = async (type) => {
    setLoading(prev => ({ ...prev, import: true }));
    try {
      const response = await axios.post(`/index/import/${type}`, null, {
        timeout: 60000 // 60 seconds timeout for potentially long import
      });
      toast.success(`${type.toUpperCase()} dataset imported successfully`);
      await fetchInitialData();
    } catch (error) {
      const errorMessage = error.response?.data?.message || `Error importing ${type} dataset`;
      console.error('Import Error:', error.response?.data);
      toast.error(errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, import: false }));
    }
  };

  const handleRecreateIndex = async () => {
    setDialogConfig({
      title: 'Confirm Index Recreation',
      message: 'Are you sure you want to recreate the index? This will delete all existing data.',
      confirmText: 'Recreate Index',
      onConfirm: async () => {
        setLoading(prev => ({ ...prev, recreate: true }));
        try {
          await axios.post('/index/recreate');
          toast.success('Index recreated successfully');
          await fetchInitialData();
        } catch (error) {
          toast.error('Error recreating index');
        } finally {
          setLoading(prev => ({ ...prev, recreate: false }));
        }
      }
    });
    setDialogOpen(true);
  };

  /**
   * Server Status Component
   * Displays current connection status with the server
   * @component
   * @returns {JSX.Element}
   */
  const ServerStatus = () => (
    <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg 
      ${serverStatus === 'connected' ? 'bg-green-100' :
        serverStatus === 'checking' ? 'bg-yellow-100' : 'bg-red-100'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full 
          ${serverStatus === 'connected' ? 'bg-green-500' :
            serverStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium">
          {serverStatus === 'connected' ? 'Server Connected' :
            serverStatus === 'checking' ? 'Checking Connection' : 'Server Disconnected'}
        </span>
      </div>
    </div>
  );

  /**
   * Configuration Panel Component
   * Displays and manages search configuration options
   * @component
   * @returns {JSX.Element}
   */
  const ConfigurationPanel = () => (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-indigo-600" />
        Search Configuration
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tokenizer Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Tokenizer Type
          </label>
          <select
            value={searchConfig.tokenizerType}
            onChange={(e) => setSearchConfig(prev => ({
              ...prev,
              tokenizerType: e.target.value
            }))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="standard">Standard Tokenizer</option>
            <option value="custom">Custom Tokenizer</option>
          </select>
          <p className="text-sm text-gray-500">
            Standard: Splits on whitespace
            Custom: Advanced tokenization with punctuation handling
          </p>
        </div>

        {/* Stemming Toggle */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Stemming
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={searchConfig.useStemming}
              onChange={(e) => setSearchConfig(prev => ({
                ...prev,
                useStemming: e.target.checked
              }))}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-600">Enable Stemming</span>
          </div>
          <p className="text-sm text-gray-500">
            Reduces words to their root form (e.g., "running" → "run")
          </p>
        </div>

        {/* Ranking Algorithm */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Ranking Algorithm
          </label>
          <select
            value={searchConfig.rankingAlgorithm}
            onChange={(e) => setSearchConfig(prev => ({
              ...prev,
              rankingAlgorithm: e.target.value
            }))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="tf-idf">TF-IDF</option>
            <option value="tf">Term Frequency</option>
          </select>
          <p className="text-sm text-gray-500">
            TF-IDF: Considers term frequency and document frequency
            TF: Only considers term frequency
          </p>
        </div>

        {/* Length Normalization */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Length Normalization
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={searchConfig.lengthNormalization}
              onChange={(e) => setSearchConfig(prev => ({
                ...prev,
                lengthNormalization: e.target.checked
              }))}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-600">Enable Length Normalization</span>
          </div>
          <p className="text-sm text-gray-500">
            Adjusts scores based on document length to avoid bias towards longer documents
          </p>
        </div>
      </div>
    </div>
  );

  /**
   * Search Results Component
   * Displays search results in a formatted list
   * @component
   * @param {Object} props
   * @param {Array<Object>} props.documents - Array of document results
   * @returns {JSX.Element|null}
   */
  const SearchResults = ({ documents }) => {
    if (!documents.length) {
      return null;
    }

    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-indigo-600" />
          Search Results ({documents.length})
        </h2>
        <div className="space-y-6">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="border-b border-gray-200 pb-4 last:border-0 last:pb-0"
            >
              <h3 className="font-medium text-lg text-gray-900 mb-2">
                {doc.title || 'Untitled Document'}
              </h3>
              {doc.author && (
                <p className="text-sm text-gray-600 mb-2">
                  Author: {doc.author}
                </p>
              )}
              {doc.content && (
                <p className="text-gray-700 line-clamp-3">
                  {doc.content}
                </p>
              )}
              {doc.score && (
                <p className="text-sm text-gray-500 mt-2">
                  Relevance Score: {doc.score.toFixed(4)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Metrics Visualization Component
   * Displays search and index performance metrics
   * @component
   * @param {Object} props
   * @param {Object} props.metrics - Performance metrics data
   * @returns {JSX.Element|null}
   */
  const MetricsVisualization = ({ metrics }) => {
    if (!metrics) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BarChart className="h-5 w-5 text-indigo-600" />
          Search Performance Metrics
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Effectiveness Metrics */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Precision</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.precision?.toFixed(3) || 'N/A'}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Recall</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.recall?.toFixed(3) || 'N/A'}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">F1 Score</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.f1Score?.toFixed(3) || 'N/A'}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Total Hits</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.totalHits || 0}
            </p>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Query Time</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.queryTime}ms
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Tokenization Time</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.tokenizationTime}ms
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Ranking Time</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.rankingTime}ms
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Number of Tokens</h3>
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.numberOfTokens || 0}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Add this new component for the dialog
  const ConfirmDialog = () => (
    <Transition appear show={dialogOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => setDialogOpen(false)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-lg font-medium leading-6 text-gray-900">
                  {dialogConfig.title}
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">{dialogConfig.message}</p>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    onClick={() => {
                      dialogConfig.onConfirm();
                      setDialogOpen(false);
                    }}
                  >
                    {dialogConfig.confirmText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );

  // Add loading animations to the buttons
  const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <ServerStatus />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <Database className="h-8 w-8 text-indigo-600" />
            Information Retrieval System
          </h1>
          <p className="text-gray-600">Search and manage your document collection</p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter your search query..."
                disabled={loading.search}
              />
            </div>
            <button
              type="submit"
              disabled={loading.search || !searchQuery.trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading.search ? (
                <>
                  <LoadingSpinner />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              )}
            </button>
          </form>
        </div>

        {/* Document Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-indigo-600" />
            Document Management
          </h2>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              onClick={handleBulkUpload}
              disabled={loading.upload}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-all duration-200"
            >
              {loading.upload ? (
                <>
                  <LoadingSpinner />
                  Uploading...
                </>
              ) : (
                <>
                  <FileUp />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import & Index Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              Dataset Import
            </h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleImport('cisi')}
                disabled={loading.import}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading.import ? <Loader className="animate-spin" /> : <ChevronRight />}
                Import CISI
              </button>
              <button
                onClick={() => handleImport('pubmed')}
                disabled={loading.import}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading.import ? <Loader className="animate-spin" /> : <ChevronRight />}
                Import PubMed
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-red-600" />
              Index Management
            </h2>
            <button
              onClick={handleRecreateIndex}
              disabled={loading.recreate}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading.recreate ? <Loader className="animate-spin" /> : <RefreshCw />}
              Recreate Index
            </button>
          </div>
        </div>

        {/* Stats & Metrics Slider */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart className="h-5 w-5 text-indigo-600" />
            Statistics & Metrics
          </h2>
          <Slider {...sliderSettings}>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Index Statistics</h3>
              {indexStats ? (
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
                  {JSON.stringify(indexStats, null, 2)}
                </pre>
              ) : (
                <div className="text-gray-500 italic">No statistics available</div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Index Metrics</h3>
              {indexMetrics ? (
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
                  {JSON.stringify(indexMetrics, null, 2)}
                </pre>
              ) : (
                <div className="text-gray-500 italic">No metrics available</div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold mb-2">Configuration</h3>
              {Object.values(config).some(value => value !== null) ? (
                <pre className="bg-gray-50 p-4 rounded-md overflow-auto">
                  {JSON.stringify(config, null, 2)}
                </pre>
              ) : (
                <div className="text-gray-500 italic">No configuration available</div>
              )}
            </div>
          </Slider>
        </div>

        {/* Configuration Panel */}
        <ConfigurationPanel />

        {/* Search Results */}
        <SearchResults documents={documents} />

        {/* Metrics Visualization */}
        {indexMetrics && <MetricsVisualization metrics={indexMetrics} />}
      </div>

      {/* Add the dialog component */}
      <ConfirmDialog />
    </div>
  );
}

export default App;