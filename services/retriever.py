import chromadb
from sentence_transformers import SentenceTransformer

# Load the same embedding model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Connect to the same ChromaDB
client = chromadb.PersistentClient(path="chroma_db")

collection = client.get_or_create_collection(
    name="industrial_documents"
)


def search_documents(query, top_k=3):

    query_embedding = embedding_model.encode(query).tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )

    docs = results["documents"][0]

    return docs