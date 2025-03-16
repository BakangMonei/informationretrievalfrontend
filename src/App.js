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

  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: false
  };

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(prev => ({ ...prev, search: true }));
    try {
      const response = await axios.post('/documents/search', {
        query: searchQuery,
        ...searchConfig
      });
      setDocuments(response.data.results);

      // Display search metrics
      if (response.data.metrics) {
        setIndexMetrics(response.data.metrics);
      }

      toast.success(`Found ${response.data.totalHits} results in ${response.data.queryTime}ms`);
    } catch (error) {
      if (error.response?.status === 404) {
        setDocuments([]);
        toast.info('No documents found matching your search');
      } else {
        toast.error('Error searching documents');
      }
    } finally {
      setLoading(prev => ({ ...prev, search: false }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    toast.success(`Selected file: ${file.name}`);
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setLoading(prev => ({ ...prev, upload: true }));
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post('/documents/bulk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          toast.loading(`Uploading: ${percentCompleted}%`, {
            id: 'uploadProgress',
          });
        },
        timeout: 30000 // 30 seconds
      });

      toast.success('Documents uploaded successfully');
      await fetchIndexStats();
      setSelectedFile(null);

      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error uploading documents';
      console.error('Upload Error:', error.response?.data);
      toast.error(errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, upload: false }));
      toast.dismiss('uploadProgress');
    }
  };

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
    if (!window.confirm('Are you sure you want to recreate the index? This will delete all existing data.')) {
      return;
    }

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
  };

  // Add this component for server status
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

  // Add this component before the return statement
  const ConfigurationPanel = () => (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-indigo-600" />
        Search Configuration
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tokenizer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
        </div>

        {/* Stemming Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
        </div>

        {/* Ranking Algorithm */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
        </div>

        {/* Length Normalization */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
        </div>
      </div>
    </div>
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
                className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Search documents..."
              />
            </div>
            <button
              type="submit"
              disabled={loading.search}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center gap-2 disabled:opacity-50"
            >
              {loading.search ? <Loader className="animate-spin" /> : <Search />}
              Search
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
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading.upload ? <Loader className="animate-spin" /> : <FileUp />}
              Upload
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
        {documents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600" />
              Search Results
            </h2>
            <div className="mb-4">
              <h3 className="font-medium text-gray-700">Search Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-500">Precision</p>
                  <p className="text-lg font-semibold">{indexMetrics?.precision?.toFixed(3) || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-500">Recall</p>
                  <p className="text-lg font-semibold">{indexMetrics?.recall?.toFixed(3) || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-500">F1 Score</p>
                  <p className="text-lg font-semibold">{indexMetrics?.f1Score?.toFixed(3) || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-500">Query Time</p>
                  <p className="text-lg font-semibold">{indexMetrics?.queryTime}ms</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {documents.map((doc, index) => (
                <div key={index} className="border-b pb-4">
                  <h3 className="font-medium">{doc.title}</h3>
                  <p className="text-gray-600">{doc.content}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    <span className="mr-4">Score: {doc.score?.toFixed(4)}</span>
                    <span>Rank: {index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 