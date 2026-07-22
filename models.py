from pydantic import BaseModel

class IngestRequest(BaseModel):
    documentId: str
    filePath: str
    fileType: str
    originalName: str


class QueryRequest(BaseModel):
    userId: str
    question: str
    documentId: str | None = None