export interface Document {
  path: string;
  content: string;
  format: "markdown" | "json" | "text";
  createdAt: string;
  updatedAt: string;
  checksum: string;
  metadata?: Record<string, any>;
}

export interface Spec {
  id: string;
  title: string;
  content: string;
  status: "draft" | "active" | "deprecated";
  tags: string[];
  parent?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  history: Array<{
    version: number;
    updatedAt: string;
    changeSummary?: string;
  }>;
}

export interface StoreInterface {
  // Document operations
  saveDocument(doc: Document): Promise<void>;
  getDocument(path: string): Promise<Document | null>;
  deleteDocument(path: string): Promise<boolean>;
  listDocuments(prefix?: string): Promise<Document[]>;
  searchDocuments(query: string): Promise<Document[]>;

  // Spec operations
  saveSpec(spec: Spec): Promise<void>;
  getSpec(id: string): Promise<Spec | null>;
  deleteSpec(id: string): Promise<boolean>;
  listSpecs(filter?: { status?: string; tag?: string; parent?: string }): Promise<Spec[]>;
}
