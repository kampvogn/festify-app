import { DataSnapshot, Query } from '@firebase/database-types';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import 'firebase/functions';
import { eventChannel } from 'redux-saga';

import firebaseConfig from '../../firebase.config.js';
import { isFirebaseBackend } from './backend';

const app = isFirebaseBackend ? firebase.initializeApp(firebaseConfig) : null;
export default app;

export { firebase as firebaseNS };

const firebaseUnavailable = () => {
    throw new Error('Firebase is unavailable in self-hosted mode.');
};

export const functions = app
    ? {
          clientToken: app.functions().httpsCallable('getClientToken'),
          exchangeCode: app.functions().httpsCallable('exchangeCode'),
          isSpotifyUser: app.functions().httpsCallable('isSpotifyUser'),
          linkSpotifyAccounts: app.functions().httpsCallable('linkSpotifyAccounts'),
          refreshToken: app.functions().httpsCallable('refreshToken'),
      }
    : {
          clientToken: firebaseUnavailable,
          exchangeCode: firebaseUnavailable,
          isSpotifyUser: firebaseUnavailable,
          linkSpotifyAccounts: firebaseUnavailable,
          refreshToken: firebaseUnavailable,
      };

export function valuesChannel(ref: Query) {
    return eventChannel<DataSnapshot>(put => {
        ref.on('value', put as (snap: DataSnapshot) => void);
        return () => ref.off('value', put);
    });
}
