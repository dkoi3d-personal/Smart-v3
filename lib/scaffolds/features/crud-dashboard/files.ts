/**
 * CRUD Dashboard Template - File Contents
 */

import { TemplateFile } from '../types';

export const crudDashboardFiles: TemplateFile[] = [
  // ==================== COMPONENTS ====================
  {
    path: 'components/data-table/DataTable.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Sortable, filterable data table',
    content: `'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { Pagination } from './Pagination';
import { FilterBar } from './FilterBar';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

export function DataTable<T extends { id: number | string }>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  onRowClick,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Add actions column if edit or delete handlers provided
  const tableColumns = useMemo(() => {
    if (!onEdit && !onDelete) return columns;

    return [
      ...columns,
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(row.original);
                }}
                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(row.original);
                }}
                className="px-2 py-1 text-xs bg-destructive/10 text-destructive rounded hover:bg-destructive/20"
              >
                Delete
              </button>
            )}
          </div>
        ),
      },
    ] as ColumnDef<T, any>[];
  }, [columns, onEdit, onDelete]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <FilterBar
        value={globalFilter}
        onChange={setGlobalFilter}
        placeholder={searchPlaceholder}
      />

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:bg-muted/80"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No data found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={\`border-t border-border hover:bg-muted/50 \${onRowClick ? 'cursor-pointer' : ''}\`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={table.getState().pagination.pageIndex + 1}
        totalPages={table.getPageCount()}
        pageSize={table.getState().pagination.pageSize}
        onPageChange={(page) => table.setPageIndex(page - 1)}
        onPageSizeChange={(size) => table.setPageSize(size)}
      />
    </div>
  );
}`,
  },

  {
    path: 'components/data-table/Pagination.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Table pagination component',
    content: `'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-border rounded bg-background text-foreground"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages || 1}
        </span>

        <div className="flex gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={!canGoPrevious}
            className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ««
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            «
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext}
            className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »»
          </button>
        </div>
      </div>
    </div>
  );
}`,
  },

  {
    path: 'components/data-table/FilterBar.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Search and filter controls',
    content: `'use client';

interface FilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterBar({ value, onChange, placeholder = 'Search...' }: FilterBarProps) {
  return (
    <div className="flex gap-4">
      <div className="relative flex-1 max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}`,
  },

  {
    path: 'components/data-table/index.ts',
    type: 'lib',
    description: 'Data table exports',
    content: `export { DataTable } from './DataTable';
export { Pagination } from './Pagination';
export { FilterBar } from './FilterBar';`,
  },

  {
    path: 'components/forms/CrudForm.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Reusable CRUD form component',
    content: `'use client';

import { useState } from 'react';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface CrudFormProps {
  fields: FormField[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export function CrudForm({
  fields,
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isLoading = false,
}: CrudFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = \`\${field.label} is required\`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await onSubmit(formData);
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      value: formData[field.name] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleChange(field.name, e.target.value),
      placeholder: field.placeholder,
      required: field.required,
      className: \`w-full px-4 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary \${
        errors[field.name] ? 'border-destructive' : 'border-border'
      }\`,
    };

    switch (field.type) {
      case 'textarea':
        return <textarea {...commonProps} rows={4} />;
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">Select {field.label}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      default:
        return <input {...commonProps} type={field.type} />;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="block text-sm font-medium text-foreground mb-1">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {renderField(field)}
          {errors[field.name] && (
            <p className="mt-1 text-sm text-destructive">{errors[field.name]}</p>
          )}
        </div>
      ))}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}`,
  },

  {
    path: 'components/modals/DeleteConfirmModal.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Delete confirmation modal',
    content: `'use client';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  title = 'Confirm Delete',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
        </div>

        <p className="text-muted-foreground mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}`,
  },

  {
    path: 'components/modals/FormModal.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Form modal wrapper',
    content: `'use client';

interface FormModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function FormModal({ isOpen, title, onClose, children }: FormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}`,
  },

  // ==================== API ROUTES ====================
  {
    path: 'app/api/crud/[resource]/route.ts',
    type: 'api',
    description: 'Generic CRUD list and create endpoints',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Map resource names to Prisma models
// Add your models here as needed
const RESOURCE_MAP: Record<string, any> = {
  // Example: users: prisma.user,
  // Example: products: prisma.product,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await params;
    const model = RESOURCE_MAP[resource];

    if (!model) {
      return NextResponse.json(
        { error: \`Resource '\${resource}' not found\` },
        { status: 404 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause for search (customize per resource)
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ].filter(Boolean),
        }
      : {};

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      model.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[CRUD] List error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await params;
    const model = RESOURCE_MAP[resource];

    if (!model) {
      return NextResponse.json(
        { error: \`Resource '\${resource}' not found\` },
        { status: 404 }
      );
    }

    const body = await request.json();

    // TODO: Add validation per resource type
    const record = await model.create({
      data: body,
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error('[CRUD] Create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`,
  },

  {
    path: 'app/api/crud/[resource]/[id]/route.ts',
    type: 'api',
    description: 'Generic CRUD single item endpoints',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Map resource names to Prisma models
// Add your models here as needed
const RESOURCE_MAP: Record<string, any> = {
  // Example: users: prisma.user,
  // Example: products: prisma.product,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await params;
    const model = RESOURCE_MAP[resource];

    if (!model) {
      return NextResponse.json(
        { error: \`Resource '\${resource}' not found\` },
        { status: 404 }
      );
    }

    const record = await model.findUnique({
      where: { id: parseInt(id) },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error('[CRUD] Get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await params;
    const model = RESOURCE_MAP[resource];

    if (!model) {
      return NextResponse.json(
        { error: \`Resource '\${resource}' not found\` },
        { status: 404 }
      );
    }

    const body = await request.json();

    const record = await model.update({
      where: { id: parseInt(id) },
      data: body,
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error('[CRUD] Update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await params;
    const model = RESOURCE_MAP[resource];

    if (!model) {
      return NextResponse.json(
        { error: \`Resource '\${resource}' not found\` },
        { status: 404 }
      );
    }

    await model.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRUD] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`,
  },

  // ==================== HOOKS ====================
  {
    path: 'hooks/useCrud.ts',
    type: 'hook',
    description: 'CRUD operations hook',
    content: `'use client';

import { useState, useCallback } from 'react';

interface UseCrudOptions<T> {
  resource: string;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface CrudState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useCrud<T extends { id: number | string }>({
  resource,
  onSuccess,
  onError,
}: UseCrudOptions<T>) {
  const [state, setState] = useState<CrudState<T>>({
    data: [],
    loading: false,
    error: null,
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });

  const baseUrl = \`/api/crud/\${resource}\`;

  const fetchList = useCallback(async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const res = await fetch(\`\${baseUrl}?\${searchParams}\`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setState((prev) => ({
        ...prev,
        data: json.data,
        pagination: json.pagination,
        loading: false,
      }));

      return json.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      onError?.(message);
      return [];
    }
  }, [baseUrl, onError]);

  const create = useCallback(async (data: Partial<T>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setState((prev) => ({
        ...prev,
        data: [json.data, ...prev.data],
        loading: false,
      }));

      onSuccess?.(json.data);
      return json.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      onError?.(message);
      return null;
    }
  }, [baseUrl, onSuccess, onError]);

  const update = useCallback(async (id: number | string, data: Partial<T>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(\`\${baseUrl}/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setState((prev) => ({
        ...prev,
        data: prev.data.map((item) => (item.id === id ? json.data : item)),
        loading: false,
      }));

      onSuccess?.(json.data);
      return json.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      onError?.(message);
      return null;
    }
  }, [baseUrl, onSuccess, onError]);

  const remove = useCallback(async (id: number | string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(\`\${baseUrl}/\${id}\`, { method: 'DELETE' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== id),
        loading: false,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      setState((prev) => ({ ...prev, error: message, loading: false }));
      onError?.(message);
      return false;
    }
  }, [baseUrl, onError]);

  return {
    ...state,
    fetchList,
    create,
    update,
    remove,
  };
}`,
  },
];
