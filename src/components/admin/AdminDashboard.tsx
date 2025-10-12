import { useState, useEffect } from "react"
import { Box, Tab, Tabs, Typography, Chip } from "@mui/material"
import { UserManagement } from "./UserManagement"
import { ReferenceDataManagement } from "./ReferenceDataManagement"
import { OrganizationConfig } from "./OrganizationConfig"
import { DatabaseCleanup } from "./DatabaseCleanup"
import { useOutletContext } from "react-router-dom"
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { PERMISSION_NAMES } from '../../config/permissions'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

interface AdminContext {
  isReadOnly?: boolean;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  )
}

function a11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  }
}

export function AdminDashboard() {
  const context = useOutletContext<AdminContext>();
  const { user } = useSelector((state: RootState) => state.auth);
  const isReadOnly = context?.isReadOnly ?? (user?.permissionLevel === 2);
  const permissionName = user?.permissionLevel ? PERMISSION_NAMES[user.permissionLevel] : '';
  
  // Initialize from localStorage or default to 0
  const [value, setValue] = useState(() => {
    const savedTab = localStorage.getItem('adminDashboardTab')
    return savedTab ? parseInt(savedTab, 10) : 0
  })

  // Save to localStorage whenever tab changes
  useEffect(() => {
    localStorage.setItem('adminDashboardTab', value.toString())
  }, [value])

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue)
  }

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Admin Dashboard
        </Typography>
        <Chip 
          label={`${permissionName} ${isReadOnly ? '(View Only)' : ''}`}
          color={isReadOnly ? 'default' : 'primary'}
          sx={{ ml: 2 }}
        />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="admin tabs">
          <Tab label="User Management" {...a11yProps(0)} />
          <Tab label="Reference Data" {...a11yProps(1)} />
          <Tab label="Organization Settings" {...a11yProps(2)} />
          <Tab label="Database Cleanup" {...a11yProps(3)} />
        </Tabs>
      </Box>

      <TabPanel value={value} index={0}>
        <UserManagement isReadOnly={isReadOnly} />
      </TabPanel>

      <TabPanel value={value} index={1}>
        <ReferenceDataManagement isReadOnly={isReadOnly} />
      </TabPanel>

      <TabPanel value={value} index={2}>
        <OrganizationConfig />
      </TabPanel>

      <TabPanel value={value} index={3}>
        <DatabaseCleanup />
      </TabPanel>
    </Box>
  )
}
