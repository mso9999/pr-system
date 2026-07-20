import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BasicInformationStep } from '../../steps/BasicInformationStep';
import { FormState } from '../../NewPRForm';
import { serviceMocks, resetAllMocks } from './mocks';

const mockFormState: FormState = {
  organization: '1PWR LESOTHO',
  requestor: 'John Doe',
  email: 'john@example.com',
  department: 'IS&T',
  projectCategory: '',
  description: '',
  site: '',
  expenseType: '',
  vehicle: '',
  estimatedAmount: 0,
  currency: 'USD',
  requiredDate: '',
  approvers: [],
  preferredVendor: '',
  lineItems: [],
  quotes: [],
  isUrgent: false
};

const mockReferenceData = {
  departments: [
    { id: 'IST', name: 'IS&T — Information Systems and Technology', code: 'IST', isActive: true },
    { id: 'FIN', name: 'Finance', code: 'FIN', isActive: true }
  ],
  projectCategories: [
    { id: '1', name: 'Infrastructure', code: 'INFRA', isActive: true },
    { id: '2', name: 'Software', code: 'SW', isActive: true }
  ],
  sites: [
    { id: '1', name: 'Main Office', code: 'HQ', isActive: true },
    { id: '2', name: 'Branch', code: 'BR', isActive: true }
  ],
  expenseTypes: [
    { id: '1', name: 'Capital', code: 'CAP', isActive: true },
    { id: '2', name: 'Operational', code: 'OP', isActive: true },
    { id: 'vehicle', name: 'Vehicle Maintenance', code: 'VM', isActive: true }
  ],
  vehicles: [
    { id: '1', name: 'Toyota Hilux', code: 'TH1', isActive: true }
  ],
  vendors: [
    { id: '1', name: 'Vendor A', code: 'VA', isActive: true }
  ],
  approvers: [
    { id: '1', name: 'Jane Approver', email: 'jane@example.com', role: 'MANAGER' }
  ],
  organizations: [
    { id: '1PWR LESOTHO', name: '1PWR LESOTHO', code: '1PWR LESOTHO', isActive: true },
    { id: 'SMP', name: 'SMP', code: 'SMP', isActive: true }
  ]
};

describe('BasicInformationStep', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render all form fields with correct initial state', () => {
    const setFormState = vi.fn();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Organization field
    const orgField = screen.getByRole('combobox', { name: /organization/i });
    expect(orgField).toBeInTheDocument();
    expect(orgField).toBeDisabled();
    expect(orgField).toHaveValue('1PWR LESOTHO');
    expect(screen.getByText('Organization is fixed to 1PWR LESOTHO')).toBeInTheDocument();

    // Required fields with labels
    expect(screen.getByRole('textbox', { name: /requestor/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /department/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /project category/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /site/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /expense type/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /estimated amount/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /currency/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /urgency level/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /approvers/i })).toBeInTheDocument();

    // Optional fields
    expect(screen.getByRole('combobox', { name: /preferred vendor/i })).toBeInTheDocument();
    expect(screen.getByText('Optional - Select if you have a preferred vendor')).toBeInTheDocument();

    // Helper texts
    expect(screen.getByText('Provide a clear description of what you are requesting')).toBeInTheDocument();
    expect(screen.getByText("Select 'Urgent' only if this request requires immediate attention")).toBeInTheDocument();
    expect(screen.getByText('Select at least one approver')).toBeInTheDocument();
  });

  it('should validate estimated amount', async () => {
    const setFormState = vi.fn();
    const invalidFormState = { ...mockFormState, estimatedAmount: 0 };
    
    render(
      <BasicInformationStep
        formState={invalidFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    const amountField = screen.getByRole('spinbutton', { name: /estimated amount/i });
    expect(amountField).toHaveValue(0);
    expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();

    await userEvent.clear(amountField);
    await userEvent.type(amountField, '100');
    
    expect(setFormState).toHaveBeenCalledWith(expect.objectContaining({
      estimatedAmount: 100
    }));
  });

  it('should handle currency selection', async () => {
    const setFormState = vi.fn();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    const currencySelect = screen.getByRole('combobox', { name: /currency/i });
    await userEvent.click(currencySelect);

    // Check currency options
    expect(screen.getByText('LSL - Lesotho Loti')).toBeInTheDocument();
    expect(screen.getByText('USD - US Dollar')).toBeInTheDocument();
    expect(screen.getByText('ZAR - South African Rand')).toBeInTheDocument();

    // Select a currency
    await userEvent.click(screen.getByText('LSL - Lesotho Loti'));
    
    expect(setFormState).toHaveBeenCalledWith(expect.objectContaining({
      currency: 'LSL'
    }));
  });

  it('should handle urgency level selection', async () => {
    const setFormState = vi.fn();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    const urgencySelect = screen.getByRole('combobox', { name: /urgency level/i });
    await userEvent.click(urgencySelect);

    // Check urgency options
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();

    // Select urgent
    await userEvent.click(screen.getByText('Urgent'));
    
    expect(setFormState).toHaveBeenCalledWith(expect.objectContaining({
      isUrgent: true
    }));
  });

  it('should validate email format', async () => {
    const setFormState = vi.fn();
    const user = userEvent.setup();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    const emailField = screen.getByRole('textbox', { name: /email/i });
    
    // Test invalid email
    await user.clear(emailField);
    await user.type(emailField, 'invalid-email');
    await user.tab(); // Trigger blur event
    
    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();

    // Test valid email
    await user.clear(emailField);
    await user.type(emailField, 'test@example.com');
    await user.tab(); // Trigger blur event
    
    expect(screen.queryByText('Please enter a valid email')).not.toBeInTheDocument();
  });

  it('should handle approver selection', async () => {
    const setFormState = vi.fn();
    const user = userEvent.setup();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    const approverSelect = screen.getByRole('combobox', { name: /approvers/i });
    await user.click(approverSelect);

    // Check approver options
    expect(screen.getByText('Jane Approver')).toBeInTheDocument();

    // Select an approver
    await user.click(screen.getByText('Jane Approver'));
    
    expect(setFormState).toHaveBeenCalledWith(expect.any(Function));
    
    // Get the function that was passed to setFormState
    const updateFunction = setFormState.mock.calls[0][0];
    const previousState = mockFormState;
    const newState = updateFunction(previousState);
    
    // Verify the function updates the state correctly
    expect(newState).toEqual(expect.objectContaining({
      approvers: ['1']
    }));
  });

  it('should render initial form fields', () => {
    const setFormState = vi.fn();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Check if required fields are rendered using test IDs
    expect(screen.getByLabelText('Organization', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /requestor/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /department/i })).toBeInTheDocument();
  });

  it('should update form state when fields change', async () => {
    const setFormState = vi.fn();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Find and update description field
    const descriptionField = screen.getByLabelText('Description');
    await userEvent.type(descriptionField, 'Test Description');

    expect(setFormState).toHaveBeenCalled();
  });

  it('should show vehicle selection only for relevant expense types', async () => {
    const setFormState = vi.fn();
    const user = userEvent.setup();
    
    const { rerender } = render(
      <BasicInformationStep
        formState={{ ...mockFormState, expenseType: '' }}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Initially, vehicle field should not be visible
    const initialVehicleField = screen.queryByRole('combobox', { name: /vehicle/i });
    expect(initialVehicleField).not.toBeInTheDocument();

    // Rerender with vehicle expense type
    rerender(
      <BasicInformationStep
        formState={{ ...mockFormState, expenseType: 'vehicle', vehicle: '' }}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Vehicle field should now be visible
    const vehicleField = screen.getByRole('combobox', { name: /vehicle/i });
    expect(vehicleField).toBeInTheDocument();

    // Should show vehicle options
    await user.click(vehicleField);
    expect(screen.getByText('Toyota Hilux')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const setFormState = vi.fn();
    const invalidFormState = { ...mockFormState, requestor: '', email: '' };
    
    render(
      <BasicInformationStep
        formState={invalidFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Error messages should be displayed
    expect(screen.getByText('Requestor is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    const setFormState = vi.fn();
    
    render(
      <BasicInformationStep
        formState={mockFormState}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={true}
      />
    );

    // Loading indicator should be visible
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should handle organization selection', async () => {
    const setFormState = vi.fn();
    const user = userEvent.setup();
    
    render(
      <BasicInformationStep
        formState={{ ...mockFormState, organization: '' }}
        setFormState={setFormState}
        departments={mockReferenceData.departments}
        projectCategories={mockReferenceData.projectCategories}
        sites={mockReferenceData.sites}
        expenseTypes={mockReferenceData.expenseTypes}
        vehicles={mockReferenceData.vehicles}
        vendors={mockReferenceData.vendors}
        approvers={mockReferenceData.approvers}
        organizations={mockReferenceData.organizations}
        loading={false}
      />
    );

    // Check that organization is required
    const organizationField = screen.getByRole('combobox', { name: /organization/i });
    expect(screen.getByText('Organization is required')).toBeInTheDocument();

    // Select an organization
    await user.click(organizationField);
    await user.click(screen.getByText('SMP'));

    expect(setFormState).toHaveBeenCalledWith(expect.any(Function));
    
    // Get the function that was passed to setFormState
    const updateFunction = setFormState.mock.calls[0][0];
    const previousState = mockFormState;
    const newState = updateFunction(previousState);
    
    // Verify the function updates the state correctly
    expect(newState).toEqual(expect.objectContaining({
      organization: 'SMP'
    }));
  });
});
