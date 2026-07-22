import chromadb
from sentence_transformers import SentenceTransformer

# Load embedding model only once
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Create ChromaDB client
client = chromadb.PersistentClient(path="chroma_db")

# Create or get collection
collection = client.get_or_create_collection(
    name="industrial_documents"
)


def store_chunks(chunks, filename):
    """
    Store document chunks into ChromaDB
    """

    embeddings = embedding_model.encode(chunks).tolist()

    ids = []

    metadatas = []

    for i, chunk in enumerate(chunks):

        ids.append(f"{filename}_{i}")

        metadatas.append({

            "source": filename,

            "chunk": i

        })

    collection.add(

        ids=ids,

        documents=chunks,

        embeddings=embeddings,

        metadatas=metadatas

    )