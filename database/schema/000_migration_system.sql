-- Migration version tracking
CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64)
);

-- Record initial schema
INSERT INTO schema_migrations (version, description) 
VALUES ('001', 'Initial schema creation');
