'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  RefreshCw,
  Download,
  Table,
  Key,
  Link,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  provider: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  ssl?: boolean;
  status: string;
  createdAt: string;
}

interface DatabaseColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string;
  references?: {
    table: string;
    column: string;
  };
}

interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
}

interface DatabaseSchema {
  tables: DatabaseTable[];
  version: string;
}

const DB_TYPES = [
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { value: 'mongodb', label: 'MongoDB', icon: '🍃' },
  { value: 'mysql', label: 'MySQL', icon: '🐬' },
  { value: 'sqlite', label: 'SQLite', icon: '📁' },
  { value: 'redis', label: 'Redis', icon: '⚡' },
];

const PROVIDERS = {
  postgresql: [
    { value: 'supabase', label: 'Supabase' },
    { value: 'neon', label: 'Neon' },
    { value: 'aws-rds', label: 'AWS RDS' },
    { value: 'local', label: 'Local/Self-hosted' },
    { value: 'custom', label: 'Custom' },
  ],
  mongodb: [
    { value: 'mongodb-atlas', label: 'MongoDB Atlas' },
    { value: 'local', label: 'Local/Self-hosted' },
    { value: 'custom', label: 'Custom' },
  ],
  mysql: [
    { value: 'planetscale', label: 'PlanetScale' },
    { value: 'aws-rds', label: 'AWS RDS' },
    { value: 'local', label: 'Local/Self-hosted' },
    { value: 'custom', label: 'Custom' },
  ],
  sqlite: [
    { value: 'local', label: 'Local File' },
  ],
  redis: [
    { value: 'local', label: 'Local' },
    { value: 'custom', label: 'Custom' },
  ],
};

const COLUMN_TYPES: Record<string, string[]> = {
  postgresql: ['SERIAL', 'BIGSERIAL', 'INTEGER', 'BIGINT', 'TEXT', 'VARCHAR(255)', 'BOOLEAN', 'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'UUID', 'JSON', 'JSONB', 'DECIMAL', 'REAL'],
  mongodb: ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'Array', 'Object'],
  mysql: ['INT', 'BIGINT', 'VARCHAR(255)', 'TEXT', 'BOOLEAN', 'DATETIME', 'TIMESTAMP', 'DATE', 'JSON', 'DECIMAL', 'FLOAT'],
  sqlite: ['INTEGER', 'TEXT', 'REAL', 'BLOB'],
  redis: ['string', 'list', 'set', 'hash', 'zset'],
};

export default function DatabaseSettingsPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);

  // Form states
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    type: 'postgresql',
    provider: 'supabase',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: true,
    connectionString: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [useConnectionString, setUseConnectionString] = useState(false);

  // Table form
  const [tableForm, setTableForm] = useState<DatabaseTable>({
    name: '',
    columns: [{ name: 'id', type: 'SERIAL', primaryKey: true }],
  });

  // Load connections
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/database');
        if (res.ok) {
          const data = await res.json();
          setConnections(data.connections || []);
          setActiveConnectionId(data.activeConnectionId);
          if (data.activeConnectionId && data.schemas?.[data.activeConnectionId]) {
            setSchema(data.schemas[data.activeConnectionId]);
          }
        }
      } catch (error) {
        console.error('Failed to load database config:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load schema when connection changes
  useEffect(() => {
    async function loadSchema() {
      if (!activeConnectionId) return;

      try {
        const res = await fetch(`/api/database/schema?connectionId=${activeConnectionId}`);
        if (res.ok) {
          const data = await res.json();
          setSchema(data.schema);
        }
      } catch (error) {
        console.error('Failed to load schema:', error);
      }
    }
    loadSchema();
  }, [activeConnectionId]);

  // Save connection
  const handleSaveConnection = async () => {
    try {
      const res = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionForm),
      });

      if (res.ok) {
        const connection = await res.json();
        setConnections([...connections, connection]);
        setShowConnectionDialog(false);
        resetConnectionForm();
      }
    } catch (error) {
      console.error('Failed to save connection:', error);
    }
  };

  // Delete connection
  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const res = await fetch(`/api/database/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConnections(connections.filter(c => c.id !== id));
        if (activeConnectionId === id) {
          setActiveConnectionId(null);
          setSchema(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  // Save schema
  const handleSaveSchema = async () => {
    if (!activeConnectionId || !schema) return;

    try {
      await fetch('/api/database/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: activeConnectionId,
          schema,
        }),
      });
    } catch (error) {
      console.error('Failed to save schema:', error);
    }
  };

  // Add table
  const handleAddTable = () => {
    if (!schema) {
      setSchema({ tables: [], version: '1.0.0' });
    }
    setTableForm({ name: '', columns: [{ name: 'id', type: 'SERIAL', primaryKey: true }] });
    setEditingTable(null);
    setShowTableDialog(true);
  };

  // Save table
  const handleSaveTable = () => {
    if (!tableForm.name) return;

    const newSchema = schema || { tables: [], version: '1.0.0' };

    if (editingTable) {
      // Update existing table
      const index = newSchema.tables.findIndex(t => t.name === editingTable.name);
      if (index !== -1) {
        newSchema.tables[index] = tableForm;
      }
    } else {
      // Add new table
      newSchema.tables.push(tableForm);
    }

    setSchema({ ...newSchema });
    setShowTableDialog(false);
  };

  // Delete table
  const handleDeleteTable = (tableName: string) => {
    if (!schema) return;
    setSchema({
      ...schema,
      tables: schema.tables.filter(t => t.name !== tableName),
    });
  };

  // Generate migration
  const handleGenerateMigration = async (format: 'sql' | 'prisma') => {
    if (!activeConnectionId) return;

    try {
      const res = await fetch('/api/database/schema', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: activeConnectionId, format }),
      });

      if (res.ok) {
        const data = await res.json();
        // Download the file
        const blob = new Blob([data.output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to generate migration:', error);
    }
  };

  // Reset form
  const resetConnectionForm = () => {
    setConnectionForm({
      name: '',
      type: 'postgresql',
      provider: 'supabase',
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
      ssl: true,
      connectionString: '',
    });
    setShowPassword(false);
    setUseConnectionString(false);
  };

  // Add column to table form
  const addColumn = () => {
    setTableForm({
      ...tableForm,
      columns: [...tableForm.columns, { name: '', type: 'TEXT' }],
    });
  };

  // Update column in table form
  const updateColumn = (index: number, field: string, value: any) => {
    const newColumns = [...tableForm.columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setTableForm({ ...tableForm, columns: newColumns });
  };

  // Remove column from table form
  const removeColumn = (index: number) => {
    setTableForm({
      ...tableForm,
      columns: tableForm.columns.filter((_, i) => i !== index),
    });
  };

  const activeConnection = connections.find(c => c.id === activeConnectionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8 text-primary" />
            Database Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage database connections and design schemas
          </p>
        </div>
        <Button onClick={() => setShowConnectionDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="schema" disabled={!activeConnectionId}>
            Schema Designer
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Database Connections</h3>
                <p className="text-muted-foreground mb-4">
                  Add a database connection to get started
                </p>
                <Button onClick={() => setShowConnectionDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Connection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {connections.map(conn => (
                <Card
                  key={conn.id}
                  className={`cursor-pointer transition-colors ${
                    activeConnectionId === conn.id ? 'border-primary' : ''
                  }`}
                  onClick={() => setActiveConnectionId(conn.id)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">
                          {DB_TYPES.find(t => t.value === conn.type)?.icon || '📦'}
                        </div>
                        <div>
                          <h3 className="font-semibold">{conn.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {conn.host}:{conn.port}/{conn.database}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={conn.status === 'connected' ? 'default' : 'secondary'}>
                          {conn.status}
                        </Badge>
                        <Badge variant="outline">{conn.provider}</Badge>
                        {activeConnectionId === conn.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConnection(conn.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Schema Designer Tab */}
        <TabsContent value="schema" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Schema for {activeConnection?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Design your database tables and relationships
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleGenerateMigration('sql')}>
                <Download className="h-4 w-4 mr-2" />
                Export SQL
              </Button>
              <Button variant="outline" onClick={() => handleGenerateMigration('prisma')}>
                <Download className="h-4 w-4 mr-2" />
                Export Prisma
              </Button>
              <Button onClick={handleAddTable}>
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
            </div>
          </div>

          {!schema || schema.tables.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Table className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Tables Defined</h3>
                <p className="text-muted-foreground mb-4">
                  Start by adding a table to your schema
                </p>
                <Button onClick={handleAddTable}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Table
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {schema.tables.map(table => (
                <Card key={table.name}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Table className="h-5 w-5" />
                        {table.name}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTableForm(table);
                            setEditingTable(table);
                            setShowTableDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTable(table.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <UITable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Constraints</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.columns.map((col, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{col.name}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {col.type}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {col.primaryKey && (
                                  <Badge variant="default" className="text-xs">
                                    <Key className="h-3 w-3 mr-1" />
                                    PK
                                  </Badge>
                                )}
                                {col.unique && (
                                  <Badge variant="secondary" className="text-xs">
                                    Unique
                                  </Badge>
                                )}
                                {col.nullable && (
                                  <Badge variant="outline" className="text-xs">
                                    Nullable
                                  </Badge>
                                )}
                                {col.references && (
                                  <Badge variant="outline" className="text-xs">
                                    <Link className="h-3 w-3 mr-1" />
                                    {col.references.table}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </UITable>
                  </CardContent>
                </Card>
              ))}

              <Button onClick={handleSaveSchema} className="w-full">
                Save Schema
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Connection Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Database Connection</DialogTitle>
            <DialogDescription>
              Configure your database connection details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Connection Name</Label>
              <Input
                placeholder="My Database"
                value={connectionForm.name}
                onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Database Type</Label>
                <Select
                  value={connectionForm.type}
                  onValueChange={(value) => setConnectionForm({
                    ...connectionForm,
                    type: value,
                    provider: (PROVIDERS as any)[value]?.[0]?.value || 'custom',
                    port: value === 'postgresql' ? 5432 : value === 'mysql' ? 3306 : value === 'mongodb' ? 27017 : value === 'redis' ? 6379 : 0,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DB_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          {type.icon} {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={connectionForm.provider}
                  onValueChange={(value) => setConnectionForm({ ...connectionForm, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(PROVIDERS as any)[connectionForm.type]?.map((p: any) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useConnectionString"
                checked={useConnectionString}
                onChange={(e) => setUseConnectionString(e.target.checked)}
              />
              <Label htmlFor="useConnectionString">Use connection string</Label>
            </div>

            {useConnectionString ? (
              <div className="space-y-2">
                <Label>Connection String</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="postgresql://user:pass@host:5432/db"
                    value={connectionForm.connectionString}
                    onChange={(e) => setConnectionForm({ ...connectionForm, connectionString: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Host</Label>
                    <Input
                      placeholder="localhost"
                      value={connectionForm.host}
                      onChange={(e) => setConnectionForm({ ...connectionForm, host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={connectionForm.port}
                      onChange={(e) => setConnectionForm({ ...connectionForm, port: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Database Name</Label>
                  <Input
                    placeholder="myapp"
                    value={connectionForm.database}
                    onChange={(e) => setConnectionForm({ ...connectionForm, database: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      placeholder="postgres"
                      value={connectionForm.username}
                      onChange={(e) => setConnectionForm({ ...connectionForm, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={connectionForm.password}
                        onChange={(e) => setConnectionForm({ ...connectionForm, password: e.target.value })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ssl"
                    checked={connectionForm.ssl}
                    onChange={(e) => setConnectionForm({ ...connectionForm, ssl: e.target.checked })}
                  />
                  <Label htmlFor="ssl">Use SSL</Label>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConnection}>
              Save Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Dialog */}
      <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTable ? 'Edit Table' : 'Add Table'}</DialogTitle>
            <DialogDescription>
              Define the table structure with columns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Table Name</Label>
              <Input
                placeholder="users"
                value={tableForm.name}
                onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Columns</Label>
              {tableForm.columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="column_name"
                    value={col.name}
                    onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={col.type}
                    onValueChange={(value) => updateColumn(idx, 'type', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(COLUMN_TYPES[activeConnection?.type || 'postgresql'] || COLUMN_TYPES.postgresql).map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={col.primaryKey ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateColumn(idx, 'primaryKey', !col.primaryKey)}
                      title="Primary Key"
                    >
                      <Key className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={col.nullable ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateColumn(idx, 'nullable', !col.nullable)}
                      title="Nullable"
                    >
                      ?
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeColumn(idx)}
                    disabled={tableForm.columns.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addColumn}>
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTable}>
              {editingTable ? 'Update Table' : 'Add Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
