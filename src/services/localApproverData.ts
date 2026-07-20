import { User } from '../types/user';

export const approvers: User[] = [
  {
    id: 'admin1',
    name: 'System Admin',
    email: 'admin@1pwrafrica.com',
    role: 'ADMIN',
    department: 'IS&T',
    isActive: true,
    approvalLimit: 1000
  },
  {
    id: 'finance1',
    name: 'Finance Manager',
    email: 'finance@1pwrafrica.com',
    role: 'FINANCE_APPROVER',
    department: 'Finance',
    isActive: true,
    approvalLimit: 100000
  },
  {
    id: 'proc1',
    name: 'Procurement Officer',
    email: 'procurement@1pwrafrica.com',
    role: 'PROCUREMENT',
    department: 'Procurement',
    isActive: true,
    approvalLimit: 50000
  }
];
