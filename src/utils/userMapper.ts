import { UserReference } from '@/types/pr';

/**
 * Maps a Firebase user to a UserReference object
 */
export function mapFirebaseUserToUserReference(firebaseUser: any): UserReference {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email || 'Unknown User',
    email: firebaseUser.email || '',
    firstName: firebaseUser.displayName?.split(' ')[0] || '',
    lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
  };
}

