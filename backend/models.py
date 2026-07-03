from sqlalchemy import Boolean, Column, Integer, String, DateTime, Float, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    description = Column(String, nullable=True)
    industry = Column(String(50), default="General")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    documents = relationship("Document", back_populates="project")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    filename = Column(String)
    file_path = Column(String)
    status = Column(String, default="uploaded") # uploaded, processing, processed, failed
    doc_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="documents")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    records = relationship("ExtractedRecord", back_populates="document", cascade="all, delete-orphan")

class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    page_number = Column(Integer)
    image_path = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    ocr_json = Column(JSON, nullable=True)
    text_content = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)

    document = relationship("Document", back_populates="pages")

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    industry = Column(String(50), default="General")
    schema_json = Column(JSON)
    validation_rules = Column(JSON, nullable=True)

    records = relationship("ExtractedRecord", back_populates="template")

class ExtractedRecord(Base):
    __tablename__ = "extracted_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    record_data = Column(JSON)
    confidence = Column(Float, nullable=True)
    needs_review = Column(Boolean, default=False)
    status = Column(String, default="pending") # pending, approved, rejected
    
    document = relationship("Document", back_populates="records")
    template = relationship("Template", back_populates="records")
