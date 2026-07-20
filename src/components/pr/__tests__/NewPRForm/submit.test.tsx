import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NewPRForm } from '../../NewPRForm';
import { FormState } from '../../NewPRForm';
import { serviceMocks, mockPRService, mockNotificationSystem, mockRouter, resetAllMocks } from './mocks';

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockRouter.navigate
}));

// Mock Redux hooks
vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector: any) => selector({
    auth: {
      user: {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        organization: '1PWR LESOTHO'
      },
      loading: false
    }
  })
}));

// Create a test store
const store = configureStore({
  reducer: {
    auth: (state = {
      user: {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        organization: '1PWR LESOTHO'
      },
      loading: false
    }, action) => state
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

const validFormState: FormState = {
  organization: '1PWR LESOTHO',
  requestor: 'John Doe',
  email: 'john@example.com',
  department: 'IS&T',
  projectCategory: 'Infrastructure',
  description: 'Test PR',
  site: 'Main Office',
  expenseType: 'Capital',
  estimatedAmount: 1000,
  currency: 'USD',
  requiredDate: '2025-02-01',
  approvers: ['approver1'],
  lineItems: [
    {
      description: 'Item 1',
      quantity: 2,
      uom: 'PCS',
      notes: '',
      attachments: []
    }
  ],
  quotes: [],
  isUrgent: false
};

// Wrap component with router and redux provider for testing
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('NewPRForm Submission', () => {
  beforeEach(() => {
    resetAllMocks();
    // Setup default mock responses
    mockPRService.createPR.mockResolvedValue({ id: 'test-pr-id' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should handle successful form submission', async () => {
    renderWithProviders(<NewPRForm />);

    // Fill in form data (simplified for test)
    const descriptionField = screen.getByRole('textbox', { name: /item description/i });
    await userEvent.type(descriptionField, 'Test PR Description');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit purchase request/i });
    await userEvent.click(submitButton);

    // Check if PR service was called
    expect(mockPRService.createPR).toHaveBeenCalled();

    // Check if success notification was shown
    expect(mockNotificationSystem.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('PR created successfully')
    );

    // Check if navigation occurred
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      expect.stringContaining('/pr/test-pr-id')
    );
  });

  it('should display error notification on submission failure', async () => {
    mockPRService.createPR.mockRejectedValue(new Error('Submission failed'));
    
    renderWithProviders(<NewPRForm />);

    // Fill in form data
    const descriptionField = screen.getByRole('textbox', { name: /item description/i });
    await userEvent.type(descriptionField, 'Test PR Description');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit purchase request/i });
    await userEvent.click(submitButton);

    // Check if error notification was shown
    expect(mockNotificationSystem.showError).toHaveBeenCalledWith(
      expect.stringContaining('failed')
    );

    // Check that we didn't navigate
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should show loading state during submission', async () => {
    // Make PR creation take some time
    mockPRService.createPR.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ id: 'test-pr-id' }), 1000);
    }));

    renderWithProviders(<NewPRForm />);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit purchase request/i });
    await userEvent.click(submitButton);

    // Loading indicator should be visible
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    
    // Submit button should be disabled
    expect(submitButton).toBeDisabled();

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('should validate all required fields before submission', async () => {
    renderWithProviders(<NewPRForm />);

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /submit purchase request/i });
    await userEvent.click(submitButton);

    // Error messages should be displayed
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one line item is required/i)).toBeInTheDocument();

    // PR service should not have been called
    expect(mockPRService.createPR).not.toHaveBeenCalled();
  });

  it('should navigate to PR details page after successful submission', async () => {
    mockPRService.createPR.mockResolvedValue({ id: 'test-pr-id' });
    
    renderWithProviders(<NewPRForm />);

    // Fill in form data
    const descriptionField = screen.getByRole('textbox', { name: /item description/i });
    await userEvent.type(descriptionField, 'Test PR Description');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit purchase request/i });
    await userEvent.click(submitButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(mockRouter.navigate).toHaveBeenCalledWith('/pr/test-pr-id');
    });
  });

  it('should handle file uploads during submission', async () => {
    renderWithProviders(<NewPRForm />);

    // Add a line item with attachment
    const addItemButton = screen.getByRole('button', { name: /add line item/i });
    await userEvent.click(addItemButton);

    // Upload file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit purchase request/i });
    await userEvent.click(submitButton);

    // Check if file was included in PR creation
    expect(mockPRService.createPR).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                name: 'test.pdf'
              })
            ])
          })
        ])
      })
    );
  });
});
