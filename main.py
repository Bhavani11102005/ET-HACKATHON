from fastapi import FastAPI
import os

from models import IngestRequest, QueryRequest

from services.chunker import chunk_text
from services.pdf_reader import extract_pdf_text
from services.vector_store import store_chunks
from services.retriever import search_documents
from services.groq_service import ask_gemini

# ------------------------------------
# FastAPI App
# ------------------------------------
app = FastAPI(
    title="Industrial Knowledge AI",
    version="1.0"
)

# ------------------------------------
# Upload Folder
# ------------------------------------
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ------------------------------------
# Home API
# ------------------------------------
@app.get("/")
def home():
    return {
        "message": "Industrial Knowledge AI Backend Running 🚀"
    }

# ------------------------------------
# Ingest API
# Called by Member 2 Backend
# ------------------------------------
@app.post("/ingest")
def ingest(request: IngestRequest):

    # Check file exists
    if not os.path.exists(request.filePath):
        return {
            "error": "File not found",
            "filePath": request.filePath
        }

    # Read PDF
    text = extract_pdf_text(request.filePath)

    if not text:
        return {
            "error": "No text found in document"
        }

    # Chunk document
    chunks = chunk_text(text)

    # Store in ChromaDB
    store_chunks(chunks, request.documentId)

    # Simple keyword extraction
    words = text.split()
    keywords = list(set(words[:10]))

    return {
        "aiDocumentId": request.documentId,
        "summary": "Document processed successfully.",
        "keywords": keywords
    }

# ------------------------------------
# Query API
# Called by Member 2 Backend
# ------------------------------------
@app.post("/query")
def query(request: QueryRequest):

    docs = search_documents(request.question)

    if len(docs) == 0:
        return {
            "answer": "I couldn't find this information in the uploaded documents.",
            "citations": [],
            "confidenceScore": 0.0
        }

    context = "\n\n".join(docs)

    answer = ask_gemini(
        context=context,
        question=request.question
    )

    return {
        "answer": answer,
        "citations": [
            {
                "documentId": request.documentId,
                "documentName": "Uploaded Document",
                "snippet": docs[0],
                "page": 1,
                "confidence": 0.95
            }
        ],
        "confidenceScore": 0.95
    }