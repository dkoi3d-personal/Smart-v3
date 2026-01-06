/**
 * CRUD Dashboard Template - Test Files
 */

import { TemplateTestFile } from '../types';

export const crudDashboardTests: TemplateTestFile[] = [
  {
    path: '__tests__/crud/data-table.test.tsx',
    framework: 'vitest',
    description: 'DataTable component tests',
    content: `import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '@/components/data-table/DataTable';

const mockData = [
  { id: 1, name: 'Item 1', email: 'item1@example.com' },
  { id: 2, name: 'Item 2', email: 'item2@example.com' },
  { id: 3, name: 'Item 3', email: 'item3@example.com' },
];

const mockColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

describe('DataTable', () => {
  it('renders data rows', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows "No data found" when empty', () => {
    render(<DataTable data={[]} columns={mockColumns} />);

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('filters data when searching', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'Item 1' } });

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    // Other items should be filtered out
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onRowClick={onRowClick} />);

    fireEvent.click(screen.getByText('Item 1'));

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('renders edit button when onEdit provided', () => {
    const onEdit = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onEdit={onEdit} />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(3);
  });

  it('renders delete button when onDelete provided', () => {
    const onDelete = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons).toHaveLength(3);
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onEdit={onEdit} />);

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(onEdit).toHaveBeenCalledWith(mockData[0]);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(onDelete).toHaveBeenCalledWith(mockData[0]);
  });
});`,
  },

  {
    path: '__tests__/crud/pagination.test.tsx',
    framework: 'vitest',
    description: 'Pagination component tests',
    content: `import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '@/components/data-table/Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    pageSize: 10,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it('displays current page and total pages', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
  });

  it('disables previous buttons on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled(); // First page
    expect(buttons[1]).toBeDisabled(); // Previous
  });

  it('disables next buttons on last page', () => {
    render(<Pagination {...defaultProps} currentPage={5} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[2]).toBeDisabled(); // Next
    expect(buttons[3]).toBeDisabled(); // Last page
  });

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]); // Next button

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange when clicking previous', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Previous button

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when clicking first', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // First button

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when clicking last', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[3]); // Last button

    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('calls onPageSizeChange when selecting new page size', () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '20' } });

    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });
});`,
  },

  {
    path: '__tests__/crud/crud-form.test.tsx',
    framework: 'vitest',
    description: 'CrudForm component tests',
    content: `import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrudForm, FormField } from '@/components/forms/CrudForm';

const mockFields: FormField[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
];

describe('CrudForm', () => {
  it('renders all fields', () => {
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('shows required indicator for required fields', () => {
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Required fields should have asterisk
    const labels = screen.getAllByText('*');
    expect(labels).toHaveLength(2); // name and email are required
  });

  it('populates initial data', () => {
    const initialData = {
      name: 'Test Name',
      email: 'test@example.com',
    };

    render(
      <CrudForm
        fields={mockFields}
        initialData={initialData}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Test Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const onSubmit = vi.fn();
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    const submitButton = screen.getByText('Save');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });

    const submitButton = screen.getByText('Save');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test',
        email: 'test@example.com',
      });
    });
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn();
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('uses custom submit label', () => {
    render(
      <CrudForm
        fields={mockFields}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create"
      />
    );

    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});`,
  },

  {
    path: '__tests__/crud/useCrud.test.ts',
    framework: 'vitest',
    description: 'useCrud hook tests',
    content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCrud } from '@/hooks/useCrud';

const mockFetch = vi.fn();
global.fetch = mockFetch;

interface TestItem {
  id: number;
  name: string;
}

describe('useCrud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() => useCrud<TestItem>({ resource: 'items' }));

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('fetchList', () => {
    it('fetches and sets data', async () => {
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: mockData,
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        }),
      });

      const { result } = renderHook(() => useCrud<TestItem>({ resource: 'items' }));

      await act(async () => {
        await result.current.fetchList();
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.pagination.total).toBe(2);
    });

    it('handles fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useCrud<TestItem>({ resource: 'items', onError })
      );

      await act(async () => {
        await result.current.fetchList();
      });

      expect(result.current.error).toBe('Server error');
      expect(onError).toHaveBeenCalledWith('Server error');
    });
  });

  describe('create', () => {
    it('creates and adds item', async () => {
      const newItem = { id: 1, name: 'New Item' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: newItem }),
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() =>
        useCrud<TestItem>({ resource: 'items', onSuccess })
      );

      await act(async () => {
        await result.current.create({ name: 'New Item' });
      });

      expect(result.current.data).toContainEqual(newItem);
      expect(onSuccess).toHaveBeenCalledWith(newItem);
    });
  });

  describe('update', () => {
    it('updates item in list', async () => {
      const updatedItem = { id: 1, name: 'Updated' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 1, name: 'Original' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: updatedItem }),
        });

      const { result } = renderHook(() => useCrud<TestItem>({ resource: 'items' }));

      await act(async () => {
        await result.current.fetchList();
      });

      await act(async () => {
        await result.current.update(1, { name: 'Updated' });
      });

      expect(result.current.data[0].name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('removes item from list', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 1, name: 'Item' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const { result } = renderHook(() => useCrud<TestItem>({ resource: 'items' }));

      await act(async () => {
        await result.current.fetchList();
      });

      expect(result.current.data).toHaveLength(1);

      await act(async () => {
        await result.current.remove(1);
      });

      expect(result.current.data).toHaveLength(0);
    });
  });
});`,
  },
];
