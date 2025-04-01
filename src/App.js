import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
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
axios.defaults.timeout = 30000; // Increase default timeout to 30 seconds

// Add axios interceptors for better error handling
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ERR_NETWORK') {
      toast.error('Cannot connect to server. Make sure the backend is running.');
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Request timed out. The operation might still be processing.');
    } else if (error.response?.status === 500) {
      const errorMessage = error.response?.data?.message || 'An internal server error occurred';
      console.error('Server Error:', error.response?.data);
      toast.error(`Server Error: ${errorMessage}`);
    } else if (error.response?.status === 404) {
      toast.error('The requested resource was not found');
    } else if (error.response?.status === 400) {
      const details = error.response.data.details || error.response.data.message;
      toast.error(`Validation Error: ${details}`);
    } else {
      toast.error('An unexpected error occurred');
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

// Add API endpoints from controllers
const API_ENDPOINTS = {
  // IR Controller endpoints
  ir: {
    index: '/ir/index',
    search: '/ir/search',
    evaluate: '/ir/evaluate'
  },
  // Index Controller endpoints
  index: {
    recreate: '/index/recreate',
    stats: '/index/stats',
    importCisi: '/index/import/cisi',
    importPubmed: '/index/import/pubmed',
    config: {
      tokenizer: '/index/config/tokenizer',
      stemming: '/index/config/stemming',
      ranking: '/index/config/ranking',
      normalization: '/index/config/normalization'
    },
    metrics: '/index/metrics',
    health: '/index/health'
  },
  // Document Controller endpoints
  documents: {
    create: '/documents',
    getById: (id) => `/documents/${id}`,
    getAll: '/documents',
    update: (id) => `/documents/${id}`,
    delete: (id) => `/documents/${id}`,
    search: '/documents/search',
    bulkImport: '/documents/bulk',
    upload: '/documents/upload'
  }
};

// Add DocumentDetailModal component
const DocumentDetailModal = ({ selectedDoc, setSelectedDoc, currentPage, fetchDocuments }) => {
  if (!selectedDoc) return null;

  const handleDelete = async () => {
    try {
      await axios.delete(API_ENDPOINTS.documents.delete(selectedDoc.id));
      toast.success('Document deleted successfully');
      setSelectedDoc(null);
      fetchDocuments(currentPage);
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(API_ENDPOINTS.documents.update(selectedDoc.id), selectedDoc);
      toast.success('Document updated successfully');
      setSelectedDoc(null);
      fetchDocuments(currentPage);
    } catch (error) {
      toast.error('Failed to update document');
    }
  };

  return (
    <Dialog open={!!selectedDoc} onClose={() => setSelectedDoc(null)}>
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-6">
          <Dialog.Title className="text-lg font-medium">{selectedDoc.title}</Dialog.Title>
          <form onSubmit={handleUpdate} className="mt-4">
            <input
              type="text"
              value={selectedDoc.title}
              onChange={e => setSelectedDoc(prev => ({ ...prev, title: e.target.value }))}
              className="w-full rounded border p-2"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

/**
 * Main Application Component
 * Provides document search, upload, and index management functionality
 * @component
 * @returns {JSX.Element} The rendered application
 */
function App() {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [indexMetrics, setIndexMetrics] = useState(null);
  const [indexStats, setIndexStats] = useState(null);
  const [config, setConfig] = useState({
    normalization: {},
    ranking: {},
    stemming: {},
    tokenizer: {}
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState({
    search: false,
    upload: false,
    import: false,
    recreate: false
  });
  const [serverStatus, setServerStatus] = useState('checking');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [indexHealth, setIndexHealth] = useState({ status: 'UP', details: '' });

  // Index Configuration States
  const [searchConfig, setSearchConfig] = useState({
    tokenizerType: 'standard',
    useStemming: false,
    rankingAlgorithm: 'tf-idf',
    lengthNormalization: true,
    evaluationMode: false,
    useRelevanceJudgments: false,
    relevanceThreshold: 0.5
  });

  // Add new state for dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState({
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => { },
  });

  // Add new state variables for IR evaluation
  // eslint-disable-next-line no-unused-vars
  const [evaluationMetrics, setEvaluationMetrics] = useState({
    precisionRecall: [],
    indexingStats: {
      timeToIndex: null,
      tokenCount: null,
      uniqueTokenCount: null,
      indexSize: null
    },
    tokenizationComparison: {
      standard: {},
      custom: {}
    }
  });

  // Move fetchInitialData before useEffect and wrap it in useCallback
  const fetchInitialData = useCallback(async () => {
    const connectionStatus = await checkServerConnection();

    if (!connectionStatus.connected) {
      toast.error('Cannot connect to server. Make sure the backend is running.');
      return;
    }

    if (!connectionStatus.indexExists) {
      toast.info(
        <div className="flex flex-col gap-1">
          <strong>No index found</strong>
          <p>Please import a dataset or upload documents to create an index</p>
        </div>,
        { duration: 5000 }
      );
      return;
    }

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
  }, []); // Add dependencies if needed

  // Update useEffect to use fetchInitialData
  useEffect(() => {
    const initializeApp = async () => {
      await checkServerHealth();
      if (serverStatus === 'connected') {
        await fetchInitialData();
      }
    };

    initializeApp();
  }, [serverStatus, fetchInitialData]);

  const fetchDocuments = async (page) => {
    try {
      const response = await axios.get(`/documents?page=${page}&size=10`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to fetch documents');
    }
  };

  const checkServerConnection = async () => {
    try {
      await axios.get('/index/stats');
      setServerStatus('connected');
      return { connected: true, indexExists: true };
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404 ||
          (error.response.data && error.response.data.message &&
            error.response.data.message.includes('IndexNotFound'))) {
          setServerStatus('no-index');
          return { connected: true, indexExists: false };
        }
      }
      setServerStatus('disconnected');
      console.error('Connection error:', error);
      return { connected: false, indexExists: false };
    }
  };

  const checkServerHealth = async () => {
    try {
      const { data } = await axios.get(API_ENDPOINTS.index.health);
      const status = data.status;
      setServerStatus(status === 'UP' ? 'connected' : 'unhealthy');
      setIndexHealth(data);
    } catch (error) {
      setServerStatus('disconnected');
      setIndexHealth({ status: 'DOWN', details: error.message });
    }
  };

  const fetchConfig = async () => {
    try {
      const endpoints = [
        API_ENDPOINTS.index.config.tokenizer,
        API_ENDPOINTS.index.config.ranking,
        API_ENDPOINTS.index.config.stemming,
        API_ENDPOINTS.index.config.normalization
      ];

      const results = await Promise.allSettled(
        endpoints.map(endpoint => axios.get(endpoint))
      );

      const newConfig = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          newConfig[endpoints[index].split('/').pop()] = result.value.data;
        } else {
          newConfig[endpoints[index].split('/').pop()] = null;
          console.warn(`Failed to load ${endpoints[index]} config`);
        }
      });

      setConfig(newConfig);
    } catch (error) {
      console.warn('Error fetching configurations:', error);
    }
  };

  const fetchIndexStats = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.index.stats);
      if (response.data) {
        setIndexStats(response.data);
        // Update metrics with index stats
        setIndexMetrics(prev => ({
          ...prev,
          tokenCount: response.data.totalTokens || 0,
          uniqueTokenCount: response.data.uniqueTokens || 0,
          indexSize: response.data.indexSize || 0,
          documentCount: response.data.documentCount || 0
        }));
      }
    } catch (error) {
      console.warn('Error fetching index stats:', error);
      setIndexStats(null);
      setIndexMetrics(null);
    }
  };

  const fetchIndexMetrics = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.index.metrics);
      if (response.data) {
        setIndexMetrics(prev => ({
          ...prev,
          ...response.data,
          precision: response.data.precision || 0,
          recall: response.data.recall || 0,
          f1Score: response.data.f1Score || 0,
          queryTime: response.data.queryTime || 0,
          tokenizationTime: response.data.tokenizationTime || 0,
          rankingTime: response.data.rankingTime || 0,
          numberOfTokens: response.data.numberOfTokens || 0
        }));
      }
    } catch (error) {
      console.warn('Error fetching metrics:', error);
      setIndexMetrics(null);
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
    if (!searchQuery.trim()) return;

    // First check if index exists
    try {
      const statsResponse = await axios.get(API_ENDPOINTS.index.stats);
      if (!statsResponse.data || !statsResponse.data.documentCount) {
        toast.error('No index found. Please import a dataset or upload documents first.');
        return;
      }
    } catch (error) {
      toast.error('No index found. Please import a dataset or upload documents first.');
      return;
    }

    setLoading(prev => ({ ...prev, search: true }));
    try {
      const response = await axios.post(API_ENDPOINTS.ir.search, {
        query: searchQuery,
        tokenizerType: searchConfig.tokenizerType,
        useStemming: searchConfig.useStemming,
        rankingAlgorithm: searchConfig.rankingAlgorithm,
        lengthNormalization: searchConfig.lengthNormalization
      });

      if (response.data && response.data.documents) {
        setDocuments(response.data.documents);

        // Update metrics
        if (response.data.metrics) {
          setIndexMetrics({
            ...response.data.metrics,
            totalHits: response.data.totalHits || 0,
            queryTime: response.data.searchTime || 0,
            tokenizationTime: response.data.metrics.tokenizationTime || 0,
            rankingTime: response.data.metrics.rankingTime || 0,
            numberOfTokens: response.data.metrics.tokenCount || 0,
            precision: response.data.metrics.precision || 0,
            recall: response.data.metrics.recall || 0,
            f1Score: response.data.metrics.f1Score || 0
          });
        }

        if (searchConfig.evaluationMode) {
          const evaluationResponse = await axios.post(API_ENDPOINTS.ir.evaluate, null, {
            params: {
              query: searchQuery,
              rankingAlgorithm: searchConfig.rankingAlgorithm,
              useStemming: searchConfig.useStemming
            }
          });
          setEvaluationMetrics(evaluationResponse.data);
        }
      } else {
        setDocuments([]);
        toast.info('No results found');
      }
    } catch (error) {
      console.error('Search Error:', error);
      toast.error('Search failed. Please try again.');
      setDocuments([]);
      setIndexMetrics(null);
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
    formData.append('tokenizerType', searchConfig.tokenizerType);
    formData.append('useStemming', searchConfig.useStemming);
    formData.append('rankingAlgorithm', searchConfig.rankingAlgorithm);
    formData.append('lengthNormalization', searchConfig.lengthNormalization);

    try {
      const response = await axios.post(API_ENDPOINTS.documents.bulkImport, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(`${response.data.length} documents uploaded successfully`);
      await fetchIndexStats();
    } catch (error) {
      console.error('Upload Error:', error);
      toast.error('Invalid document format or upload failed');
    } finally {
      setLoading(prev => ({ ...prev, upload: false }));
      setSelectedFile(null);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
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
      const endpoint = type === 'cisi' ? API_ENDPOINTS.index.importCisi : API_ENDPOINTS.index.importPubmed;

      // Create a custom axios instance with longer timeout for import
      const importAxios = axios.create({
        baseURL: API_BASE_URL,
        timeout: 300000, // 5 minutes timeout for import operations
        headers: {
          'Accept': 'application/json'
        }
      });

      // Show progress toast
      const progressToast = toast.loading(`Importing ${type.toUpperCase()} dataset... This may take a few minutes.`);

      const response = await importAxios.post(endpoint);

      if (response.status === 200) {
        toast.success(`${type.toUpperCase()} dataset imported successfully`, {
          id: progressToast
        });

        // Fetch updated stats and metrics
        await Promise.all([
          fetchIndexStats(),
          fetchIndexMetrics(),
          fetchConfig()
        ]);
      }
    } catch (error) {
      console.error('Import Error:', error);
      if (error.code === 'ECONNABORTED') {
        toast.error('Import operation timed out. Please check if the backend is still processing.');
      } else {
        const errorMessage = error.response?.data || `Error importing ${type} dataset`;
        toast.error(errorMessage);
      }
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
        serverStatus === 'no-index' ? 'bg-yellow-100' :
          serverStatus === 'checking' ? 'bg-yellow-100' : 'bg-red-100'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full 
          ${serverStatus === 'connected' ? 'bg-green-500' :
            serverStatus === 'no-index' ? 'bg-yellow-500' :
              serverStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium">
          {serverStatus === 'connected' ? 'Server Connected' :
            serverStatus === 'no-index' ? 'No Index Found' :
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
            onChange={(e) => {
              const type = e.target.value;
              setSearchConfig(prev => ({ ...prev, tokenizerType: type }));
              axios.put('/index/config/tokenizer', { type })
                .then(() => toast.success('Tokenizer configuration updated'))
                .catch(() => toast.error('Failed to update tokenizer'));
            }}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="standard">Standard Tokenizer</option>
            <option value="custom">Custom Tokenizer</option>
          </select>
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
              onChange={(e) => {
                const enabled = e.target.checked;
                setSearchConfig(prev => ({ ...prev, useStemming: enabled }));
                axios.put('/index/config/stemming', { enabled })
                  .then(() => toast.success('Stemming configuration updated'))
                  .catch(() => toast.error('Failed to update stemming'));
              }}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-600">Enable Stemming</span>
          </div>
        </div>

        {/* Ranking Algorithm */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Ranking Algorithm
          </label>
          <select
            value={searchConfig.rankingAlgorithm}
            onChange={(e) => {
              const algorithm = e.target.value;
              setSearchConfig(prev => ({ ...prev, rankingAlgorithm: algorithm }));
              axios.put('/index/config/ranking', { algorithm })
                .then(() => toast.success('Ranking algorithm updated'))
                .catch(() => toast.error('Failed to update ranking algorithm'));
            }}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="tf-idf">TF-IDF</option>
            <option value="tf">Term Frequency</option>
          </select>
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

  // Add a new component for initial setup guidance
  const SetupGuide = () => {
    if (serverStatus !== 'no-index') return null;

    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-indigo-800">IR System Setup Guide</h2>
        <p className="mb-4">To get started with the IR system evaluation, follow these steps:</p>

        <ol className="list-decimal pl-6 space-y-3 mb-6">
          <li>
            <strong>Import a dataset</strong> - Use one of the provided datasets (CISI or PubMed)
          </li>
          <li>
            <strong>Configure tokenization</strong> - Choose between Standard and Custom tokenization
          </li>
          <li>
            <strong>Configure ranking</strong> - Select TF or TF-IDF weighting
          </li>
          <li>
            <strong>Run queries</strong> - Search the imported collection with different parameters
          </li>
          <li>
            <strong>Analyze results</strong> - Compare precision, recall, and other metrics
          </li>
        </ol>

        <div className="bg-white p-4 rounded-md">
          <h3 className="font-medium mb-2">Quick Import</h3>
          <div className="flex gap-4">
            <button
              onClick={() => handleImport('cisi')}
              disabled={loading.import}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading.import ? <Loader className="animate-spin" /> : <Database className="h-4 w-4" />}
              Import CISI Dataset
            </button>
            <button
              onClick={() => handleImport('pubmed')}
              disabled={loading.import}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading.import ? <Loader className="animate-spin" /> : <Database className="h-4 w-4" />}
              Import PubMed Dataset
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add a new component for comparison visualization
  const ComparisonVisualization = ({ metrics }) => {
    if (!metrics) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BarChart className="h-5 w-5 text-indigo-600" />
          IR System Comparison
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-medium mb-3">Tokenizer Comparison</h3>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Standard</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Token Count: {metrics.tokenCount || 'N/A'}</li>
                    <li>Unique Tokens: {metrics.uniqueTokenCount || 'N/A'}</li>
                    <li>Tokenization Time: {metrics.tokenizationTime}ms</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Custom</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Token Count: N/A</li>
                    <li>Unique Tokens: N/A</li>
                    <li>Tokenization Time: N/A</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-3">Stemming Impact</h3>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">With Stemming</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Index Size: N/A</li>
                    <li>Token Count: N/A</li>
                    <li>Average Score: N/A</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Without Stemming</h4>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Index Size: N/A</li>
                    <li>Token Count: N/A</li>
                    <li>Average Score: N/A</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">Ranking Algorithm Comparison</h3>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">TF-IDF</h4>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Precision: {metrics.precision || 'N/A'}</li>
                  <li>Recall: {metrics.recall || 'N/A'}</li>
                  <li>F1 Score: {metrics.f1Score || 'N/A'}</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Term Frequency</h4>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Precision: N/A</li>
                  <li>Recall: N/A</li>
                  <li>F1 Score: N/A</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <ServerStatus />
      <DocumentDetailModal selectedDoc={selectedDoc} setSelectedDoc={setSelectedDoc} currentPage={currentPage} fetchDocuments={fetchDocuments} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <Database className="h-8 w-8 text-indigo-600" />
            Information Retrieval System
          </h1>
          <p className="text-gray-600">Search and manage your document collection</p>
        </div>

        {/* Setup Guide (displayed only when no index exists) */}
        <SetupGuide />

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

        {/* Add health warning if unhealthy */}
        {serverStatus === 'unhealthy' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Index Health Warning: {indexHealth.details}
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Add Document List section */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">All Documents</h2>
          <div className="space-y-4">
            {documents.map(doc => (
              <div key={doc.id} className="border-b pb-4">
                <h3 className="font-medium">{doc.title}</h3>
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={documents.length < 10}
              className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>

        {/* Configuration Panel */}
        <ConfigurationPanel />

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

        {/* Comparison Visualization (for IR evaluation) */}
        <ComparisonVisualization metrics={indexMetrics} />

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