CREATE TABLE IF NOT EXISTS widget_tickets_api (
    ticket_id TEXT PRIMARY KEY,
    title TEXT,
    subject TEXT,
    description TEXT,
    status TEXT,
    priority TEXT,
    client_name TEXT,
    client_email TEXT,
    widget_id TEXT,
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS widget_messages_api (
    id TEXT PRIMARY KEY,
    ticket_id TEXT REFERENCES widget_tickets_api(ticket_id) ON DELETE CASCADE,
    content TEXT,
    is_client BOOLEAN DEFAULT TRUE,
    user_name TEXT,
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_widget_messages_api_ticket_id ON widget_messages_api(ticket_id); 