import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PRRequest } from '../../types/pr';

interface PRState {
  currentPR: PRRequest | null;
  userPRs: PRRequest[];
  pendingApprovals: PRRequest[];
  loading: boolean;
  error: string | null;
  showOnlyMyPRs: boolean;
  myActionsFilter: boolean; // NEW: Filter for PRs/POs requiring user's action
}

const initialState: PRState = {
  currentPR: null,
  userPRs: [],
  pendingApprovals: [],
  loading: false,
  error: null,
  showOnlyMyPRs: false,
  myActionsFilter: false, // NEW: Default off
};

const prSlice = createSlice({
  name: 'pr',
  initialState,
  reducers: {
    setCurrentPR: (state, action: PayloadAction<PRRequest | null>) => {
      state.currentPR = action.payload;
      state.error = null;
    },
    setUserPRs: (state, action: PayloadAction<PRRequest[]>) => {
      state.userPRs = action.payload;
      state.error = null;
    },
    setPendingApprovals: (state, action: PayloadAction<PRRequest[]>) => {
      state.pendingApprovals = action.payload;
      state.error = null;
    },
    setShowOnlyMyPRs: (state, action: PayloadAction<boolean>) => {
      state.showOnlyMyPRs = action.payload;
    },
    setMyActionsFilter: (state, action: PayloadAction<boolean>) => {
      state.myActionsFilter = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearPRState: (state) => {
      state.currentPR = null;
      state.userPRs = [];
      state.pendingApprovals = [];
      state.loading = false;
      state.error = null;
      state.showOnlyMyPRs = false;
      state.myActionsFilter = false;
    },
    removePR: (state, action: PayloadAction<string>) => {
      state.userPRs = state.userPRs.filter(pr => pr.id !== action.payload);
      state.pendingApprovals = state.pendingApprovals.filter(pr => pr.id !== action.payload);
    },
  },
});

export const {
  setCurrentPR,
  setUserPRs,
  setPendingApprovals,
  setShowOnlyMyPRs,
  setMyActionsFilter,
  setLoading,
  setError,
  clearPRState,
  removePR,
} = prSlice.actions;

export default prSlice.reducer;
