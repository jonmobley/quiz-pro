import React, { useState, useEffect, useCallback } from 'react';
import { Download, Plus, X, Check, Menu, Share2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { firebaseBackend } from './firebase';

const QuizCreator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [autoSaveEnabled] = useState(true);
  const [, setIsSaved] = useState(true);
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [downloadWarnings, setDownloadWarnings] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharedQuizId, setSharedQuizId] = useState(null);
  const [viewMode, setViewMode] = useState('edit');
  const [sidebarView, setSidebarView] = useState('all'); // 'current' or 'all'
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [sortOption, setSortOption] = useState('recently-modified');

  const [userNames, setUserNames] = useState(['Ben', 'Blake', 'Dustin', 'Jon', 'Luke', 'Melissa', 'Skyler']);
  const [allCategories, setAllCategories] = useState([]);

  // Load userNames and categories from Firebase on mount
  useEffect(() => {
    const loadSettings = async () => {
      const [loadedUserNames, loadedCategories] = await Promise.all([
        firebaseBackend.getUserNames(),
        firebaseBackend.getCategories()
      ]);
      setUserNames(loadedUserNames);
      setAllCategories(loadedCategories);
    };
    loadSettings();
  }, []);

  // Save userNames to Firebase whenever it changes
  useEffect(() => {
    if (userNames.length > 0) {
      firebaseBackend.saveUserNames(userNames);
    }
  }, [userNames]);

  // Save categories to Firebase whenever it changes
  useEffect(() => {
    if (allCategories.length > 0) {
      firebaseBackend.saveCategories(allCategories);
    }
  }, [allCategories]);

  // Auto-switch to 'all' view when no quiz is selected
  useEffect(() => {
    if (!currentQuiz && sidebarView === 'current') {
      setSidebarView('all');
    }
  }, [currentQuiz, sidebarView]);

  const addUserName = (name) => {
    if (name.trim() && !userNames.includes(name.trim())) {
      setUserNames(prev => [...prev, name.trim()].sort());
    }
  };

  const deleteUserName = (nameToDelete) => {
    if (userNames.length <= 1) {
      alert('You must have at least one user name.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete the name "${nameToDelete}"?`)) {
      setUserNames(prev => prev.filter(name => name !== nameToDelete));
      // If the deleted name was the current user, clear the authentication
      if (currentUser === nameToDelete) {
        setIsAuthenticated(false);
        setCurrentUser('');
        localStorage.removeItem('quiz_auth');
        localStorage.removeItem('quiz_user');
      }
    }
  };

  // Check if user is already authenticated on mount
  useEffect(() => {
    const authToken = localStorage.getItem('quiz_auth');
    const savedUser = localStorage.getItem('quiz_user');
    
    // Check if there's a shared quiz ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('quiz');
    
    if (shareId) {
      setSharedQuizId(shareId);
      firebaseBackend.getQuizzes().then(allQuizzes => {
        const sharedQuiz = allQuizzes.find(q => q.shareId === shareId);
        if (sharedQuiz) {
          setCurrentQuiz(sharedQuiz);
          setHistory([JSON.parse(JSON.stringify(sharedQuiz))]);
          setHistoryIndex(0);
          setIsSaved(true);
          // If user is not authenticated, show as full page instead of preview modal
          if (authToken !== 'authenticated') {
            setViewMode('preview');
          } else {
            setViewMode('preview');
            setShowPreview(true);
          }
        }
      });
    }
    
    if (authToken === 'authenticated' && savedUser) {
      setIsAuthenticated(true);
      setCurrentUser(savedUser);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      firebaseBackend.getQuizzes().then(setQuizzes);
    }
  }, [isAuthenticated]);

  const saveToHistory = useCallback((quiz) => {
    if (!quiz) return;
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(quiz)));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setCurrentQuiz(JSON.parse(JSON.stringify(prevState)));
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setCurrentQuiz(JSON.parse(JSON.stringify(nextState)));
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (currentQuiz) {
          // Add question directly here to avoid dependency issues
          const newQuestion = {
            id: Date.now().toString(),
            question: '',
            answers: [{ text: '', correct: false }]
          };
          const updated = { ...currentQuiz, questions: [...currentQuiz.questions, newQuestion] };
          setCurrentQuiz(updated);
          saveToHistory(updated);
          setIsSaved(false);
          autoSave(updated);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, currentQuiz, saveToHistory, autoSave]);

  const autoSave = useCallback((quiz) => {
    if (!autoSaveEnabled) return;
    
    if (saveTimeout) clearTimeout(saveTimeout);
    
    const timeout = setTimeout(async () => {
      const savedQuiz = await firebaseBackend.saveQuiz({
        ...quiz,
        lastModified: new Date().toISOString()
      });
      setQuizzes(prev => {
        const filtered = prev.filter(q => q.id !== savedQuiz.id);
        return [savedQuiz, ...filtered].sort((a, b) => 
          new Date(b.lastModified) - new Date(a.lastModified)
        );
      });
      setIsSaved(true);
    }, 1000);
    
    setSaveTimeout(timeout);
  }, [saveTimeout, autoSaveEnabled]);

  const manualSave = async () => {
    if (!currentQuiz) return;
    
    const now = new Date().toISOString();
    const historyEntry = {
      user: currentUser,
      action: 'modified',
      timestamp: now
    };
    
    const savedQuiz = await firebaseBackend.saveQuiz({
      ...currentQuiz,
      history: [...(currentQuiz.history || []), historyEntry],
      lastModified: now
    });
    
    setQuizzes(prev => {
      const filtered = prev.filter(q => q.id !== savedQuiz.id);
      return [savedQuiz, ...filtered].sort((a, b) => 
        new Date(b.lastModified) - new Date(a.lastModified)
      );
    });
    
    setCurrentQuiz(savedQuiz);
    setIsSaved(true);
    setShowSavedCheck(true);
    
    setTimeout(() => {
      setShowSavedCheck(false);
    }, 2000);
  };

  const generateUniqueTitle = (baseTitle) => {
    const existingTitles = quizzes.map(q => q.title.toLowerCase());
    let title = baseTitle;
    let counter = 1;
    
    while (existingTitles.includes(title.toLowerCase())) {
      title = `${baseTitle} (${counter})`;
      counter++;
    }
    
    return title;
  };

  const createNewQuiz = async () => {
    const now = new Date().toISOString();
    const uniqueTitle = generateUniqueTitle('Untitled Quiz');
    
    const newQuiz = {
      id: Date.now().toString(),
      title: uniqueTitle,
      category: '',
      status: 'Draft',
      tags: [],
      questions: [{
        id: Date.now().toString(),
        question: '',
        answers: [{ text: '', correct: false }]
      }],
      history: [{
        user: currentUser,
        action: 'created',
        timestamp: now
      }],
      lastModified: now
    };
    
    // Save to database immediately
    const savedQuiz = await firebaseBackend.saveQuiz(newQuiz);
    setQuizzes(prev => [savedQuiz, ...prev]);
    
    setCurrentQuiz(savedQuiz);
    setHistory([JSON.parse(JSON.stringify(savedQuiz))]);
    setHistoryIndex(0);
    setIsSaved(true);
    setSidebarOpen(false);
  };

  const getAllCategories = () => {
    // Get categories from current quizzes
    const quizCategories = new Set();
    quizzes.forEach(quiz => {
      if (quiz.category) quizCategories.add(quiz.category);
    });
    
    // Combine with persistent categories
    const combined = new Set([...allCategories, ...quizCategories]);
    return Array.from(combined).filter(cat => cat.trim()).sort();
  };

  const addCategoryToPersistentList = (category) => {
    if (category && category.trim() && !allCategories.includes(category.trim())) {
      setAllCategories(prev => [...prev, category.trim()].sort());
    }
  };

  const getFilteredQuizzes = () => {
    let filtered = quizzes;
    
    // Filter by category
    if (selectedCategoryFilter !== 'All') {
      filtered = filtered.filter(quiz => quiz.category === selectedCategoryFilter);
    }
    
    // Filter by status
    if (selectedStatusFilter === 'All') {
      filtered = filtered.filter(quiz => quiz.status !== 'Archive');
    } else if (selectedStatusFilter === 'Archive') {
      filtered = filtered.filter(quiz => quiz.status === 'Archive');
    } else {
      filtered = filtered.filter(quiz => quiz.status === selectedStatusFilter);
    }
    
    // Sort the results
    if (sortOption === 'recently-modified') {
      filtered = filtered.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    } else if (sortOption === 'title') {
      filtered = filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === 'status') {
      filtered = filtered.sort((a, b) => (a.status || 'Draft').localeCompare(b.status || 'Draft'));
    }
    
    return filtered;
  };

  const getCategoryFilterOptions = () => {
    const categories = getAllCategories();
    return ['All', ...categories];
  };

  const getStatusFilterOptions = () => {
    const statuses = ['All', 'Draft', 'Need Approval', 'Approved', 'Completed', 'Archive'];
    return statuses.map(status => status === 'All' ? 'All' : `Status: ${status}`);
  };

  const getStatusFilterValue = (displayText) => {
    return displayText.startsWith('Status: ') ? displayText.replace('Status: ', '') : displayText;
  };

  const updateQuiz = useCallback((updates) => {
    const updated = { ...currentQuiz, ...updates };
    
    if (updates.status && updates.status !== currentQuiz.status) {
      const historyEntry = {
        user: currentUser,
        action: `changed status to "${updates.status}"`,
        timestamp: new Date().toISOString()
      };
      updated.history = [...(currentQuiz.history || []), historyEntry];
    }
    
    setCurrentQuiz(updated);
    saveToHistory(updated);
    setIsSaved(false);
    autoSave(updated);
  }, [currentQuiz, currentUser, saveToHistory, autoSave]);

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now().toString(),
      question: '',
      answers: [{ text: '', correct: false }]
    };
    updateQuiz({
      questions: [...currentQuiz.questions, newQuestion]
    });
  };

  const updateQuestion = (qIndex, updates) => {
    const questions = [...currentQuiz.questions];
    questions[qIndex] = { ...questions[qIndex], ...updates };
    updateQuiz({ questions });
  };

  const deleteQuestion = (qIndex) => {
    if (currentQuiz.questions.length === 1) {
      alert('Quiz must have at least one question');
      return;
    }
    updateQuiz({
      questions: currentQuiz.questions.filter((_, i) => i !== qIndex)
    });
  };

  const moveQuestion = (qIndex, direction) => {
    const newIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    if (newIndex < 0 || newIndex >= currentQuiz.questions.length) return;
    
    const questions = [...currentQuiz.questions];
    [questions[qIndex], questions[newIndex]] = [questions[newIndex], questions[qIndex]];
    updateQuiz({ questions });
  };

  const addAnswer = (qIndex) => {
    const question = currentQuiz.questions[qIndex];
    if (question.answers.length >= 4) return;
    
    updateQuestion(qIndex, {
      answers: [...question.answers, { text: '', correct: false }]
    });
  };

  const updateAnswer = (qIndex, aIndex, updates) => {
    const question = currentQuiz.questions[qIndex];
    const answers = [...question.answers];
    answers[aIndex] = { ...answers[aIndex], ...updates };
    updateQuestion(qIndex, { answers });
  };

  const deleteAnswer = (qIndex, aIndex) => {
    const question = currentQuiz.questions[qIndex];
    if (question.answers.length === 1) return;
    
    updateQuestion(qIndex, {
      answers: question.answers.filter((_, i) => i !== aIndex)
    });
  };

  const deleteQuizConfirmed = async () => {
    if (showDeleteConfirm) {
      await firebaseBackend.deleteQuiz(showDeleteConfirm.id);
      setQuizzes(prev => prev.filter(q => q.id !== showDeleteConfirm.id));
      if (currentQuiz?.id === showDeleteConfirm.id) {
        setCurrentQuiz(null);
      }
      setShowDeleteConfirm(null);
    }
  };


  const togglePreviewAnswer = (questionId, answerIndex) => {
    setPreviewAnswers(prev => {
      const key = `${questionId}-${answerIndex}`;
      const newAnswers = { ...prev };
      if (newAnswers[key]) {
        delete newAnswers[key];
      } else {
        newAnswers[key] = true;
      }
      return newAnswers;
    });
  };

  const calculateScore = () => {
    let correct = 0;
    let total = currentQuiz.questions.length;
    
    currentQuiz.questions.forEach(question => {
      const correctAnswers = question.answers
        .map((a, i) => ({ ...a, index: i }))
        .filter(a => a.correct);
      
      const selectedAnswers = question.answers
        .map((a, i) => ({ ...a, index: i }))
        .filter((a, i) => previewAnswers[`${question.id}-${i}`]);
      
      const allCorrectSelected = correctAnswers.every(ca => 
        selectedAnswers.some(sa => sa.index === ca.index)
      );
      const noIncorrectSelected = selectedAnswers.every(sa => 
        correctAnswers.some(ca => ca.index === sa.index)
      );
      
      if (allCorrectSelected && noIncorrectSelected && correctAnswers.length > 0) {
        correct++;
      }
    });
    
    return { correct, total, percentage: Math.round((correct / total) * 100) };
  };

  const generateShareUrl = async () => {
    if (!currentQuiz) return;
    
    let updatedQuiz = { ...currentQuiz };
    if (!updatedQuiz.shareId) {
      updatedQuiz.shareId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await firebaseBackend.saveQuiz(updatedQuiz);
      setCurrentQuiz(updatedQuiz);
    }
    
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?quiz=${updatedQuiz.shareId}`;
    setShareUrl(url);
    setShowShareModal(true);
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied to clipboard!');
  };

  const handleEditFromPreview = () => {
    if (!isAuthenticated) {
      setShowPreview(false);
    } else {
      setShowPreview(false);
      setViewMode('edit');
    }
  };

  const exportToExcel = () => {
    if (!currentQuiz) return;

    const warnings = [];
    
    if (currentQuiz.title === 'Untitled Quiz') {
      warnings.push('Quiz title is still "Untitled Quiz". Please give your quiz a proper title.');
    }
    
    currentQuiz.questions.forEach((q, index) => {
      const hasCorrectAnswer = q.answers.some(a => a.correct);
      if (!hasCorrectAnswer) {
        warnings.push(`Question ${index + 1} does not have any correct answer marked.`);
      }
    });
    
    if (warnings.length > 0) {
      setDownloadWarnings(warnings);
      setShowDownloadWarning(true);
      return;
    }

    const wb = XLSX.utils.book_new();
    const data = [];
    
    data.push(['Quiz Title:', currentQuiz.title]);
    if (currentQuiz.category) data.push(['Category:', currentQuiz.category]);
    if (currentQuiz.status) data.push(['Status:', currentQuiz.status]);
    data.push([]);
    
    currentQuiz.questions.forEach((q, i) => {
      data.push([`Question ${i + 1}:`, q.question]);
      q.answers.forEach((a, j) => {
        data.push([
          `Answer ${j + 1}:`,
          a.text,
          a.correct ? 'CORRECT' : ''
        ]);
      });
      data.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const sheetName = currentQuiz.title.slice(0, 31).replace(/[:\\/?*[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `${currentQuiz.title}.xlsx`);
  };

  const handleLogin = () => {
    if (!selectedUser) {
      alert('Please select your name');
      return;
    }
    if (firebaseBackend.authenticate(password)) {
      setIsAuthenticated(true);
      setCurrentUser(selectedUser);
      if (rememberMe) {
        localStorage.setItem('quiz_auth', 'authenticated');
        localStorage.setItem('quiz_user', selectedUser);
      }
      
      if (sharedQuizId && viewMode === 'preview') {
        setShowPreview(false);
        setViewMode('edit');
      }
    } else {
      alert('Incorrect password');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-6 text-center">Quiz Pro</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select your name</option>
                {userNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 mr-2"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-700">
                Remember me
              </label>
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Share Quiz</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Anyone with this link can view and take the quiz. They can also edit it if they log in.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={copyShareUrl}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Download Warning Modal */}
      {showDownloadWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2 text-red-600">Cannot Download Quiz</h3>
            <p className="text-gray-600 mb-4">
              Please fix the following issues before downloading:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-6 text-sm text-gray-700">
              {downloadWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
            <button
              onClick={() => setShowDownloadWarning(false)}
              className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Add New Category</h3>
            <input
              type="text"
              placeholder="Enter new category name"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  updateQuiz({ category: e.target.value.trim() });
                  setShowCategoryModal(false);
                }
              }}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  const input = e.target.parentElement.previousElementSibling;
                  if (input.value.trim()) {
                    updateQuiz({ category: input.value.trim() });
                    setShowCategoryModal(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && currentQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">{currentQuiz.title}</h2>
                {currentQuiz.category && (
                  <p className="text-gray-600 mt-1">{currentQuiz.category}</p>
                )}
              </div>
              <div className="flex gap-2">
                {sharedQuizId && (
                  <button
                    onClick={handleEditFromPreview}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewAnswers({});
                  }}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {currentQuiz.questions.map((question, qIndex) => (
                <div key={question.id} className="border-b pb-6 last:border-b-0">
                  <h3 className="font-medium text-lg mb-3">
                    {qIndex + 1}. {question.question || '(No question text)'}
                  </h3>
                  <div className="space-y-2">
                    {question.answers.map((answer, aIndex) => (
                      <label
                        key={aIndex}
                        className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={!!previewAnswers[`${question.id}-${aIndex}`]}
                          onChange={() => togglePreviewAnswer(question.id, aIndex)}
                          className="mt-1 w-4 h-4"
                        />
                        <span className="flex-1">{answer.text || '(Empty answer)'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t">
              <button
                onClick={() => {
                  const score = calculateScore();
                  alert(`Score: ${score.correct}/${score.total} (${score.percentage}%)`);
                }}
                className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 font-medium"
              >
                Submit Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">Delete Quiz?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{showDeleteConfirm.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteQuizConfirmed}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            {/* Category Management */}
            <div className="mb-6">
              <h4 className="text-md font-semibold mb-3">Manage Categories</h4>
              
              {/* Add New Category */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add New Category
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newCategoryName.trim()) {
                        addCategoryToPersistentList(newCategoryName.trim());
                        setNewCategoryName('');
                      }
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      if (newCategoryName.trim()) {
                        addCategoryToPersistentList(newCategoryName.trim());
                        setNewCategoryName('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Existing Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Existing Categories
                </label>
                {getAllCategories().length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No categories created yet</p>
                ) : (
                  <div className="space-y-2">
                    {getAllCategories().map(category => {
                      const quizCount = quizzes.filter(q => q.category === category).length;
                      return (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="font-medium">{category}</span>
                            <span className="text-sm text-gray-500 ml-2">({quizCount} quiz{quizCount !== 1 ? 'es' : ''})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* User Name Management */}
            <div className="mb-6">
              <h4 className="text-md font-semibold mb-3">Manage User Names</h4>
              
              {/* Add New User Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add New User Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Enter user name"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newUserName.trim()) {
                        addUserName(newUserName);
                        setNewUserName('');
                      }
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      if (newUserName.trim()) {
                        addUserName(newUserName);
                        setNewUserName('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Existing User Names */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Existing User Names
                </label>
                <div className="space-y-2">
                  {userNames.map(name => (
                    <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{name}</span>
                        {name === currentUser && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Current User</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteUserName(name)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-100 rounded"
                        disabled={userNames.length <= 1}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block fixed md:relative inset-0 md:inset-auto z-20 md:z-0 bg-white md:w-64 border-r flex flex-col h-screen md:h-auto`}>
        {/* Top Header Area */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            {/* Mobile: X button on left, centered title, New Quiz on right */}
            <div className="md:hidden flex items-center justify-between w-full">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
              <h1 
                onClick={() => {
                  setCurrentQuiz(null);
                  setSidebarView('all');
                  setSelectedCategoryFilter('All');
                }}
                className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600"
              >
                Quiz Pro
              </h1>
              <button
                onClick={createNewQuiz}
                className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 flex items-center"
              >
                <Plus size={16} />
              </button>
            </div>
            
            {/* Desktop: Original layout */}
            <div className="hidden md:flex justify-between items-center w-full">
              <h1 
                onClick={() => {
                  setCurrentQuiz(null);
                  setSidebarView('all');
                  setSelectedCategoryFilter('All');
                }}
                className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600"
              >
                Quiz Pro
              </h1>
              <button
                onClick={createNewQuiz}
                className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 flex items-center gap-1"
              >
                <Plus size={16} />
                <span className="ml-1">New</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Slider - Always visible */}
        <div className="px-4 py-3 bg-gray-50">
          <div className="flex bg-white rounded-lg p-1 border">
            <button
              onClick={() => setSidebarView('all')}
              className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                sidebarView === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Quizzes
            </button>
            <button
              onClick={currentQuiz ? () => setSidebarView('current') : undefined}
              disabled={!currentQuiz}
              className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                !currentQuiz
                  ? 'text-gray-400 cursor-not-allowed'
                  : sidebarView === 'current'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Editor
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentQuiz && sidebarView === 'current' ? (
            // Current Quiz Details
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Quiz Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Title
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-900 px-2 py-1">
                    {currentQuiz.title || 'Untitled Quiz'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentQuiz.questions?.length || 0} Questions
                  </p>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Status
                </label>
                <p className={`text-sm px-2 py-1 font-medium ${
                  (currentQuiz.status || 'Draft') === 'Draft' ? 'text-gray-700' :
                  (currentQuiz.status || 'Draft') === 'Need Approval' ? 'text-yellow-700' :
                  (currentQuiz.status || 'Draft') === 'Approved' ? 'text-blue-700' :
                  (currentQuiz.status || 'Draft') === 'Archive' ? 'text-gray-600' :
                  'text-green-700'
                }`}>
                  {currentQuiz.status || 'Draft'}
                </p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Category
                </label>
                <p className="text-sm text-gray-900 px-2 py-1">
                  {currentQuiz.category || 'None'}
                </p>
              </div>
            </div>
          ) : (
            // Show quizzes list
            <div className="flex-1 flex flex-col">
              {/* Status and Sort Dropdowns on same row */}
              <div className="px-4 py-3 bg-white">
                <div className="flex gap-3">
                  <select
                    value={getStatusFilterOptions().find(opt => getStatusFilterValue(opt) === selectedStatusFilter) || 'All'}
                    onChange={(e) => setSelectedStatusFilter(getStatusFilterValue(e.target.value))}
                    className="flex-1 pl-3 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getStatusFilterOptions().map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="flex-1 pl-3 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="recently-modified">Recent</option>
                    <option value="title">Title</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
              
              {/* Category Filter Pills */}
              <div className="px-4 py-3 bg-white">
                <div className="flex flex-wrap gap-2">
                  {getCategoryFilterOptions().map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategoryFilter(category)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        selectedCategoryFilter === category
                          ? 'bg-gray-800 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Quiz List */}
              <div className="flex-1 overflow-y-auto bg-white">
                {getFilteredQuizzes().length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {selectedCategoryFilter === 'All' && selectedStatusFilter === 'All' ? 'No quizzes yet' : 
                     selectedCategoryFilter !== 'All' && selectedStatusFilter !== 'All' ? `No quizzes in ${selectedCategoryFilter} with status ${selectedStatusFilter}` :
                     selectedCategoryFilter !== 'All' ? `No quizzes in ${selectedCategoryFilter}` :
                     `No quizzes with status ${selectedStatusFilter}`}
                  </div>
                ) : (
                  getFilteredQuizzes().map(quiz => (
                    <div
                      key={quiz.id}
                      className={`p-4 border-b hover:bg-blue-50 cursor-pointer ${currentQuiz?.id === quiz.id ? 'bg-gray-100' : ''}`}
                      onClick={() => {
                        setCurrentQuiz(quiz);
                        setHistory([JSON.parse(JSON.stringify(quiz))]);
                        setHistoryIndex(0);
                        setIsSaved(true);
                        setSidebarView('current');
                        setSidebarOpen(false);
                      }}
                    >
                      {/* Quiz Title and Status Row */}
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm truncate pr-2">{quiz.title}</div>
                        {quiz.status && (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            quiz.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            quiz.status === 'Need Approval' ? 'bg-yellow-100 text-yellow-700' :
                            quiz.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                            quiz.status === 'Archive' ? 'bg-gray-100 text-gray-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {quiz.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Settings and Logout Buttons */}
        <div className="p-4 border-t mt-auto space-y-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg hover:bg-blue-200 flex items-center justify-center"
          >
            Settings
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setCurrentUser('');
              localStorage.removeItem('quiz_auth');
              localStorage.removeItem('quiz_user');
            }}
            className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 flex items-center justify-center"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b p-4 flex items-center justify-between gap-4">
          {!currentQuiz ? (
            <>
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 hover:bg-gray-100 rounded"
              >
                <Menu size={20} />
              </button>
              <div className="flex-1 text-center md:absolute md:left-1/2 md:transform md:-translate-x-1/2">
                <h1 className="text-xl font-bold text-gray-800">Quiz Pro</h1>
              </div>
              <button
                onClick={createNewQuiz}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">New Quiz</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 hover:bg-gray-100 rounded"
              >
                <Menu size={20} />
              </button>
              
              <div className="flex-1"></div>

              <div className="flex gap-2">
                <button
                  onClick={manualSave}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    showSavedCheck
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {showSavedCheck ? (
                    <>
                      Saved
                      <Check size={16} />
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
                <button
                  onClick={generateShareUrl}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Share2 size={18} />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Preview
                </button>
              </div>

              <button
                onClick={exportToExcel}
                disabled={!currentQuiz || currentQuiz.questions.length === 0}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap ${
                  !currentQuiz || currentQuiz.questions.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                <Download size={18} />
                Download
              </button>
            </>
          )}
        </div>

        {/* Quiz Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentQuiz ? (
            <div className="max-w-6xl">
              {quizzes.filter(q => q.status !== 'Completed').length > 0 && (
                <h2 className="text-2xl font-bold mb-6">Recently Modified</h2>
              )}
              {quizzes.filter(q => q.status !== 'Completed').length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <p className="mb-4">No quizzes yet. Click "New Quiz" to create your first one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
                  {quizzes.filter(q => q.status !== 'Completed').map(quiz => (
                    <div
                      key={quiz.id}
                      onClick={() => {
                        setCurrentQuiz(quiz);
                        setHistory([JSON.parse(JSON.stringify(quiz))]);
                        setHistoryIndex(0);
                        setIsSaved(true);
                      }}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 aspect-square md:aspect-[3/2] flex flex-col"
                    >
                      <div className="p-5 flex-1 flex flex-col relative">
                        {/* Status in top right corner */}
                        {quiz.status && (
                          <span className={`absolute top-0 right-0 -mt-2 -mr-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            quiz.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            quiz.status === 'Need Approval' ? 'bg-yellow-100 text-yellow-700' :
                            quiz.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                            quiz.status === 'Archive' ? 'bg-gray-100 text-gray-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {quiz.status}
                          </span>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{quiz.title}</h3>
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>{quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="mt-auto">
                          {quiz.category && (
                            <div className="text-xs text-gray-500 mt-2">
                              Category: {quiz.category}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Status, Quiz Title and Category */}
              <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={currentQuiz.status || 'Draft'}
                    onChange={(e) => updateQuiz({ status: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Need Approval">Need Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    value={currentQuiz.title}
                    onChange={(e) => updateQuiz({ title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter quiz title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={currentQuiz.category || ''}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowCategoryModal(true);
                        } else {
                          updateQuiz({ category: e.target.value });
                        }
                      }}
                      className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a category</option>
                      {getAllCategories().map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">+ Create New Category</option>
                    </select>
                  </div>
                </div>
                
                {/* History */}
                {currentQuiz.history && currentQuiz.history.length > 0 && (
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      History
                    </label>
                    <div className="space-y-1 text-xs text-gray-600">
                      {currentQuiz.history.map((entry, index) => (
                        <div key={index}>
                          <strong>{entry.user}</strong> {entry.action} ({new Date(entry.timestamp).toLocaleString()})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Questions */}
              {currentQuiz.questions.map((question, qIndex) => (
                <div key={question.id} className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Question {qIndex + 1}
                      </label>
                      <input
                        type="text"
                        value={question.question}
                        onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter question"
                      />
                    </div>
                    <div className="flex gap-1">
                      {currentQuiz.questions.length > 1 && (
                        <>
                          <button
                            onClick={() => moveQuestion(qIndex, 'up')}
                            disabled={qIndex === 0}
                            className={`px-2 py-1 text-xs rounded ${
                              qIndex === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 border'
                            }`}
                            title="Move question up"
                          >
                            Move Up
                          </button>
                          <button
                            onClick={() => moveQuestion(qIndex, 'down')}
                            disabled={qIndex === currentQuiz.questions.length - 1}
                            className={`px-2 py-1 text-xs rounded ${
                              qIndex === currentQuiz.questions.length - 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 border'
                            }`}
                            title="Move question down"
                          >
                            Move Down
                          </button>
                        </>
                      )}
                      {currentQuiz.questions.length > 1 && (
                        <button
                          onClick={() => deleteQuestion(qIndex)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {question.answers.map((answer, aIndex) => (
                      <div key={aIndex} className="flex items-center gap-2">
                        <button
                          onClick={() => updateAnswer(qIndex, aIndex, { correct: !answer.correct })}
                          className={`p-2 rounded ${
                            answer.correct
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          <Check size={18} />
                        </button>
                        <input
                          type="text"
                          value={answer.text}
                          onChange={(e) => updateAnswer(qIndex, aIndex, { text: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={`Answer ${aIndex + 1}`}
                        />
                        {question.answers.length > 1 && (
                          <button
                            onClick={() => deleteAnswer(qIndex, aIndex)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {question.answers.length < 4 && (
                    <button
                      onClick={() => addAnswer(qIndex)}
                      className="mt-3 text-sm text-blue-500 hover:text-blue-600"
                    >
                      + Add Answer
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addQuestion}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500"
              >
                + Add Question (Ctrl+Enter)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizCreator;