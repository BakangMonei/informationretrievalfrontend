# Information Retrieval System API Documentation

## Base URL
`http://localhost:8080/api`

## Document Management Endpoints

### 1. Documents (`/api/documents`)
#### POST
- **Description:** Creates a new document
- **Request Body:**
```json
{
    "title": "Sample Document",
    "content": "Document content here",
    "author": "John Doe",
    "collection": "general"
}
```
- **Response:** `201 Created`

#### GET
- **Description:** Retrieves all documents (with pagination)
- **Query Parameters:** 
  - `page` (default: 0)
  - `size` (default: 10)
- **Response:** `200 OK`
```json
{
    "content": [
        {
            "id": "123",
            "title": "Sample Document",
            "content": "Content...",
            "author": "John Doe",
            "collection": "general"
        }
    ],
    "totalPages": 5,
    "totalElements": 50,
    "currentPage": 0
}
```

### 2. Bulk Document Upload (`/api/documents/bulk`)
#### POST
- **Description:** Uploads multiple documents at once
- **Request Body:** Array of documents
```json
[
    {
        "title": "Document 1",
        "content": "Content 1"
    },
    {
        "title": "Document 2",
        "content": "Content 2"
    }
]
```
- **Response:** `201 Created`

### 3. Document Search (`/api/documents/search`)
#### POST
- **Description:** Searches documents based on query and parameters
- **Request Body:**
```json
{
    "query": "search terms",
    "collection": "general",
    "rankingAlgorithm": "tf-idf",
    "tokenizerType": "standard",
    "useStemming": false,
    "applyLengthNormalization": true,
    "resultsPerPage": 10,
    "page": 0
}
```

### 4. Single Document Operations (`/api/documents/{id}`)
#### GET
- **Description:** Retrieves a specific document
- **Response:** `200 OK`

#### PUT
- **Description:** Updates a specific document
- **Request Body:** Updated document details

#### DELETE
- **Description:** Deletes a specific document
- **Response:** `204 No Content`

## Index Configuration Endpoints

### 1. Normalization Configuration (`/api/index/config/normalization`)
#### GET
- **Description:** Gets current normalization settings
#### PUT
- **Description:** Updates normalization settings
```json
{
    "enabled": true
}
```

### 2. Ranking Configuration (`/api/index/config/ranking`)
#### GET
- **Description:** Gets current ranking algorithm
#### PUT
- **Description:** Sets ranking algorithm
```json
{
    "algorithm": "tf-idf"  // or "bm25"
}
```

### 3. Stemming Configuration (`/api/index/config/stemming`)
#### GET
- **Description:** Gets stemming status
#### PUT
- **Description:** Enables/disables stemming
```json
{
    "enabled": true
}
```

### 4. Tokenizer Configuration (`/api/index/config/tokenizer`)
#### GET
- **Description:** Gets current tokenizer type
#### PUT
- **Description:** Sets tokenizer type
```json
{
    "type": "standard"  // "whitespace", "simple"
}
```

## Index Management Endpoints

### 1. Health Check (`/api/index/health`)
#### GET
- **Description:** Checks system health
- **Response:**
```json
{
    "status": "UP",
    "details": {
        "indexSize": "1.2GB",
        "documentCount": 1000
    }
}
```

### 2. Import Data (`/api/index/import`)
#### POST `/api/index/import/cisi`
- **Description:** Imports documents from CISI dataset
- **Response:** `200 OK`
```json
{
    "imported": 1460,
    "failed": 0,
    "timeElapsed": "5.2s"
}
```

#### POST `/api/index/import/pubmed`
- **Description:** Imports documents from PubMed dataset
- **Response:** `200 OK`
```json
{
    "imported": 2500,
    "failed": 0,
    "timeElapsed": "8.7s"
}
```

### 3. Index Metrics (`/api/index/metrics`)
#### GET
- **Description:** Retrieves performance metrics of the index
- **Response:** `200 OK`
```json
{
    "averageQueryTime": "45ms",
    "indexSize": "1.2GB",
    "memoryUsage": "856MB",
    "cacheHitRate": "85%"
}
```

### 4. Recreate Index (`/api/index/recreate`)
#### POST
- **Description:** Rebuilds the entire index from scratch
- **Response:** `200 OK`
```json
{
    "status": "success",
    "timeElapsed": "2m 15s",
    "documentsReindexed": 3960
}
```

### 5. Index Statistics (`/api/index/stats`)
#### GET
- **Description:** Retrieves statistical information about the index
- **Response:** `200 OK`
```json
{
    "totalDocuments": 3960,
    "collections": {
        "general": 1500,
        "academic": 2460
    },
    "uniqueTerms": 45678,
    "averageDocumentLength": 850,
    "lastUpdated": "2024-03-20T15:30:00Z"
}
```

## Error Responses

### 400 Bad Request
```json
{
    "status": 400,
    "message": "Invalid request parameters",
    "details": "Specific error details"
}
```

### 404 Not Found
```json
{
    "status": 404,
    "message": "Resource not found",
    "details": "The requested resource could not be found"
}
```

### 500 Internal Server Error
```json
{
    "status": 500,
    "message": "Internal server error",
    "details": "An unexpected error occurred"
}
```

## Usage Examples

### Configuring and Searching
```bash
# 1. Configure the system
curl -X PUT http://localhost:8080/api/index/config/tokenizer \
     -H "Content-Type: application/json" \
     -d '{"type": "standard"}'

# 2. Import CISI dataset
curl -X POST http://localhost:8080/api/index/import/cisi

# 3. Search documents
curl -X POST http://localhost:8080/api/documents/search \
     -H "Content-Type: application/json" \
     -d '{
         "query": "information retrieval systems",
         "rankingAlgorithm": "bm25",
         "useStemming": true,
         "page": 0,
         "resultsPerPage": 10
     }'
```

### Managing Documents
```bash
# Create a document
curl -X POST http://localhost:8080/api/documents \
     -H "Content-Type: application/json" \
     -d '{
         "title": "New Research Paper",
         "content": "Content of the research paper...",
         "collection": "academic"
     }'

# Get index statistics
curl http://localhost:8080/api/index/stats

# Check system health
curl http://localhost:8080/api/index/health
```

Note: All examples assume the server is running on localhost:8080. Adjust the URL according to your deployment environment.