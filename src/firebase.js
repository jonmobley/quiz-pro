import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA0Rqa9Q9vPSxfj3Rlde34shhsR2COj0cY",
  authDomain: "quiz-pro-banyan.firebaseapp.com",
  projectId: "quiz-pro-banyan",
  storageBucket: "quiz-pro-banyan.firebasestorage.app",
  messagingSenderId: "813108089605",
  appId: "1:813108089605:web:bd18316358d4128699dd6c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const firebaseBackend = {
  authenticate: (password) => {
    return password.toLowerCase() === 'banyan';
  },
  
  getQuizzes: async () => {
    try {
      const quizzesCol = collection(db, 'quizzes');
      const quizzesSnapshot = await getDocs(query(quizzesCol, orderBy('lastModified', 'desc')));
      return quizzesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting quizzes:', error);
      return [];
    }
  },
  
  saveQuiz: async (quiz) => {
    try {
      const quizRef = doc(db, 'quizzes', quiz.id);
      await setDoc(quizRef, quiz);
      return quiz;
    } catch (error) {
      console.error('Error saving quiz:', error);
      return quiz;
    }
  },
  
  deleteQuiz: async (id) => {
    try {
      await deleteDoc(doc(db, 'quizzes', id));
    } catch (error) {
      console.error('Error deleting quiz:', error);
    }
  },

  // Categories management
  getCategories: async () => {
    try {
      const categoriesSnapshot = await getDocs(collection(db, 'settings'));
      const categoriesData = categoriesSnapshot.docs.find(d => d.id === 'categories');
      return categoriesData ? categoriesData.data().list || [] : [];
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  },

  saveCategories: async (categories) => {
    try {
      const categoriesRef = doc(db, 'settings', 'categories');
      await setDoc(categoriesRef, { list: categories });
      return categories;
    } catch (error) {
      console.error('Error saving categories:', error);
      return categories;
    }
  },

  // User names management
  getUserNames: async () => {
    try {
      const userNamesSnapshot = await getDocs(collection(db, 'settings'));
      const userNamesData = userNamesSnapshot.docs.find(d => d.id === 'userNames');
      return userNamesData ? userNamesData.data().list || ['Ben', 'Blake', 'Dustin', 'Jon', 'Luke', 'Melissa', 'Skyler'] : ['Ben', 'Blake', 'Dustin', 'Jon', 'Luke', 'Melissa', 'Skyler'];
    } catch (error) {
      console.error('Error getting user names:', error);
      return ['Ben', 'Blake', 'Dustin', 'Jon', 'Luke', 'Melissa', 'Skyler'];
    }
  },

  saveUserNames: async (userNames) => {
    try {
      const userNamesRef = doc(db, 'settings', 'userNames');
      await setDoc(userNamesRef, { list: userNames });
      return userNames;
    } catch (error) {
      console.error('Error saving user names:', error);
      return userNames;
    }
  }
};