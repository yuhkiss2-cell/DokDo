import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId if specified in config, otherwise default
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Simple connection check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export interface LeaderboardEntry {
  id?: string;
  school: string;
  name: string;
  score: number;
  fishCollected: number;
  difficulty: 'easy' | 'normal' | 'hard';
  createdAt: string; // ISO string
}

// Fetch top leaderboard entries
export async function getLeaderboard(
  difficultyFilter?: 'easy' | 'normal' | 'hard',
  limitCount: number = 30
): Promise<LeaderboardEntry[]> {
  try {
    const leaderboardRef = collection(db, 'leaderboard');
    
    // We fetch sorted by score desc only (single field query, needs no custom indexes)
    // We fetch slightly more entries so that client-side difficulty filtering works perfectly
    const fetchLimit = difficultyFilter ? 200 : limitCount;
    const q = query(
      leaderboardRef,
      orderBy('score', 'desc'),
      limit(fetchLimit)
    );
    
    const snapshot = await getDocs(q);
    const entries: LeaderboardEntry[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data() as any;
      
      // Filter difficulty client-side to prevent needing compound indexes
      if (difficultyFilter && data.difficulty !== difficultyFilter) {
        return;
      }
      
      entries.push({
        id: doc.id,
        school: data.school || '',
        name: data.name || '',
        score: typeof data.score === 'number' ? data.score : 0,
        fishCollected: typeof data.fishCollected === 'number' ? data.fishCollected : 0,
        difficulty: data.difficulty || 'normal',
        createdAt: data.createdAt || '',
      });
    });
    
    // Sort client-side again to make sure everything is perfectly sorted (by score desc, then by oldest/newest createdAt)
    const sorted = entries.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Return only requested number of items
    return sorted.slice(0, limitCount);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return [];
  }
}

// Submit a new high score to the leaderboard
export async function submitScore(
  school: string,
  name: string,
  score: number,
  fishCollected: number,
  difficulty: 'easy' | 'normal' | 'hard'
): Promise<boolean> {
  try {
    const leaderboardRef = collection(db, 'leaderboard');
    await addDoc(leaderboardRef, {
      school: school.trim(),
      name: name.trim(),
      score: Math.floor(score),
      fishCollected: Math.floor(fishCollected),
      difficulty,
      createdAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('Error submitting score:', err);
    return false;
  }
}

export { db };
