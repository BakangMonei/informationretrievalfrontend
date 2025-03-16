# Information Retrieval System API Documentation

## Base URL
`http://localhost:8080/api`

## Document Endpoints

### 1. Create Document
- **Endpoint:** `POST /documents`
- **Description:** Creates a new document in the system
- **Request Body:**
```json
{
    "title": "Sample Document",
    "content": "This is the content of the document",
    "author": "John Doe",
    "collection": "general"
}
```
- **Response:** `201 Created`
```json
{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Sample Document",
    "content": "This is the content of the document",
    "author": "John Doe",
    "collection": "general"
}
```

### 2. Search Documents
- **Endpoint:** `POST /documents/search`
- **Description:** Searches documents based on query and configuration
- **Request Body:**
```json
{
    "query": "sample search query",
    "collection": "general",
    "rankingAlgorithm": "tf-idf",
    "tokenizerType": "standard",
    "useStemming": false,
    "applyLengthNormalization": true,
    "resultsPerPage": 10,
    "page": 0
}
```
- **Response:** `200 OK`
```json
{
    "results": [
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "title": "Sample Document",
            "content": "...",
            "score": 0.75
        }
    ],
    "totalHits": 1,
    "totalPages": 1,
    "currentPage": 0
}
```

## Configuration Endpoints

### 1. Tokenizer Configuration
- **GET:** `GET /index/config/tokenizer`
- **Response:**
```json
{
    "type": "standard"
}
```

- **PUT:** `PUT /index/config/tokenizer`
- **Request Body:**
```json
{
    "type": "whitespace"  // Options: "standard", "whitespace", "simple"
}
```
- **Response:** `200 OK`

### 2. Stemming Configuration
- **GET:** `GET /index/config/stemming`
- **Response:**
```json
{
    "enabled": false
}
```

- **PUT:** `PUT /index/config/stemming`
- **Request Body:**
```json
{
    "enabled": true
}
```
- **Response:** `200 OK`

### 3. Ranking Algorithm Configuration
- **GET:** `GET /index/config/ranking`
- **Response:**
```json
{
    "algorithm": "tf-idf"
}
```

- **PUT:** `PUT /index/config/ranking`
- **Request Body:**
```json
{
    "algorithm": "bm25"  // Options: "tf-idf", "bm25"
}
```
- **Response:** `200 OK`

### 4. Length Normalization Configuration
- **GET:** `GET /index/config/normalization`
- **Response:**
```json
{
    "enabled": true
}
```

- **PUT:** `PUT /index/config/normalization`
- **Request Body:**
```json
{
    "enabled": false
}
```
- **Response:** `200 OK`

## Health Check
- **GET:** `GET /health`
- **Description:** Checks if the server is running and ready
- **Response:** `200 OK`
```json
{
    "status": "UP"
}
```

## Error Responses
All endpoints may return the following error responses:

### 400 Bad Request
```json
{
    "message": "Invalid request parameters",
    "status": 400
}
```

### 404 Not Found
```json
{
    "message": "Document not found with ID: xxx",
    "status": 404
}
```

### 500 Internal Server Error
```json
{
    "message": "An unexpected error occurred",
    "status": 500,
    "error": "Error details"
}
```

## Usage Examples

### Example 1: Complete Search Flow
1. Configure the system:
```bash
# Set tokenizer
curl -X PUT http://localhost:8080/api/index/config/tokenizer \
     -H "Content-Type: application/json" \
     -d '{"type": "standard"}'

# Enable stemming
curl -X PUT http://localhost:8080/api/index/config/stemming \
     -H "Content-Type: application/json" \
     -d '{"enabled": true}'
```

2. Add a document:
```bash
curl -X POST http://localhost:8080/api/documents \
     -H "Content-Type: application/json" \
     -d '{
         "title": "Information Retrieval",
         "content": "Information retrieval is the science of searching for documents...",
         "author": "Jane Smith",
         "collection": "academic"
     }'
```

3. Search documents:
```bash
curl -X POST http://localhost:8080/api/documents/search \
     -H "Content-Type: application/json" \
     -d '{
         "query": "information search",
         "collection": "academic",
         "rankingAlgorithm": "tf-idf",
         "useStemming": true,
         "resultsPerPage": 10,
         "page": 0
     }'
```

### Example 2: Checking Current Configuration
```bash
# Get all configurations
curl http://localhost:8080/api/index/config/tokenizer
curl http://localhost:8080/api/index/config/stemming
curl http://localhost:8080/api/index/config/ranking
curl http://localhost:8080/api/index/config/normalization
```

Note: All examples assume the server is running on localhost:8080. Adjust the URL accordingly for your deployment environment.
