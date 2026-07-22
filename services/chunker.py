try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ImportError:
    # Fallback splitter if LangChain is unavailable
    class RecursiveCharacterTextSplitter:
        def __init__(self, chunk_size=500, chunk_overlap=100):
            self.chunk_size = int(chunk_size)
            self.chunk_overlap = int(chunk_overlap)

        def split_text(self, text):
            if not text:
                return []

            chunks = []
            start = 0

            while start < len(text):
                end = start + self.chunk_size
                chunks.append(text[start:end])
                start += self.chunk_size - self.chunk_overlap

            return chunks


def chunk_text(text, chunk_size=500, chunk_overlap=100):
    """
    Split text into overlapping chunks.
    """

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    return splitter.split_text(text)