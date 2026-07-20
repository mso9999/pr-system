import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineItemsStep } from '../../steps/LineItemsStep';
import { FormState } from '../../NewPRForm';
import { serviceMocks, mockStorageService, resetAllMocks } from './mocks';

const mockFormState: FormState = {
  organization: '1PWR LESOTHO',
  requestor: 'John Doe',
  email: 'john@example.com',
  department: 'IS&T',
  projectCategory: 'Infrastructure',
  description: 'Test PR',
  site: 'Main Office',
  expenseType: 'Capital',
  estimatedAmount: 0,
  currency: 'USD',
  requiredDate: '2025-02-01',
  approvers: [],
  lineItems: [],
  quotes: [],
  isUrgent: false
};

describe('LineItemsStep', () => {
  beforeEach(() => {
    resetAllMocks();
    // Mock file upload service
    mockStorageService.uploadToTempStorage.mockResolvedValue({
      url: 'https://example.com/test.pdf',
      path: 'temp/test.pdf'
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should render empty line items table initially', () => {
    const setFormState = vi.fn();
    
    render(
      <LineItemsStep
        formState={mockFormState}
        setFormState={setFormState}
        loading={false}
      />
    );

    expect(screen.getByText(/no items added/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add line item/i })).toBeInTheDocument();
  });

  it('should add new line item when add button is clicked', async () => {
    const setFormState = vi.fn();
    
    render(
      <LineItemsStep
        formState={mockFormState}
        setFormState={setFormState}
        loading={false}
      />
    );

    // Click add item button
    const addButton = screen.getByRole('button', { name: /add line item/i });
    await userEvent.click(addButton);

    // Wait for form fields to be rendered
    await waitFor(() => {
      expect(screen.getByRole('textbox', { 'aria-label': 'description' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { 'aria-label': 'quantity' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { 'aria-label': 'uom' })).toBeInTheDocument();
    });
  });

  it('should validate line item fields', async () => {
    const setFormState = vi.fn();
    const formStateWithItem = {
      ...mockFormState,
      lineItems: [{
        description: '',
        quantity: 0,
        uom: '',
        notes: '',
        attachments: []
      }]
    };
    
    render(
      <LineItemsStep
        formState={formStateWithItem}
        setFormState={setFormState}
        loading={false}
      />
    );

    // Try to save without required fields
    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    // Error messages should be displayed
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    expect(screen.getByText(/quantity must be greater than 0/i)).toBeInTheDocument();
    expect(screen.getByText(/uom is required/i)).toBeInTheDocument();
  });

  it('should calculate total amount correctly', async () => {
    const setFormState = vi.fn();
    const formStateWithItems = {
      ...mockFormState,
      lineItems: [
        {
          description: 'Item 1',
          quantity: 2,
          uom: 'PCS',
          notes: '',
          attachments: []
        },
        {
          description: 'Item 2',
          quantity: 3,
          uom: 'PCS',
          notes: '',
          attachments: []
        }
      ]
    };
    
    render(
      <LineItemsStep
        formState={formStateWithItems}
        setFormState={setFormState}
        loading={false}
      />
    );

    // Total items should be displayed
    expect(screen.getByText(/total items: 2/i)).toBeInTheDocument();
  });

  it('should handle file attachments', async () => {
    const setFormState = vi.fn();
    const uploadResult = {
      url: 'https://example.com/test.pdf',
      path: 'temp/test.pdf'
    };

    // Mock the file upload
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    mockStorageService.uploadToTempStorage.mockResolvedValue(uploadResult);

    const formStateWithItem = {
      ...mockFormState,
      lineItems: [{
        description: 'Test Item',
        quantity: 1,
        uom: 'PCS',
        notes: '',
        attachments: []
      }]
    };
    
    render(
      <LineItemsStep
        formState={formStateWithItem}
        setFormState={setFormState}
        loading={false}
      />
    );

    // Find and trigger file upload
    const fileInput = screen.getByTestId('attach-file-input');
    
    await act(async () => {
      await userEvent.upload(fileInput, file);
    });

    // Verify upload was called
    expect(mockStorageService.uploadToTempStorage).toHaveBeenCalledWith(file);

    // Wait for state update
    await waitFor(() => {
      expect(setFormState).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: [
            expect.objectContaining({
              attachments: [
                expect.objectContaining({
                  name: 'test.pdf',
                  url: uploadResult.url,
                  path: uploadResult.path
                })
              ]
            })
          ]
        })
      );
    });

    // Verify UI updates
    expect(await screen.findByText('test.pdf')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    const setFormState = vi.fn();
    
    render(
      <LineItemsStep
        formState={mockFormState}
        setFormState={setFormState}
        loading={true}
      />
    );

    // Loading indicator should be visible
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    // Add button should be disabled
    const addButton = screen.getByRole('button', { name: /add line item/i });
    expect(addButton).toBeDisabled();
  });

  it('should remove line item when delete button is clicked', async () => {
    const setFormState = vi.fn();
    const formStateWithItem = {
      ...mockFormState,
      lineItems: [
        {
          description: 'Test Item',
          quantity: 1,
          uom: 'PCS',
          notes: '',
          attachments: []
        }
      ]
    };
    
    render(
      <LineItemsStep
        formState={formStateWithItem}
        setFormState={setFormState}
        loading={false}
      />
    );

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete line item/i });
    await userEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    await userEvent.click(confirmButton);

    // Item should be removed
    expect(setFormState).toHaveBeenCalled();
    expect(screen.queryByText('Test Item')).not.toBeInTheDocument();
  });
});
