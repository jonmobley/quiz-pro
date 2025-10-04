import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Plus, X, Check, Menu, LogOut, Undo, Redo, Share2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { firebaseBackend } from './firebase';

const QuizCreator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [downloadWarnings, setDownloadWarnings] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharedQuizId, setSharedQuizId] = useState(null);
  const [viewMode, setViewMode] = useState('edit');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userNames, setUserNames] = useState(['Ben', 'Blake', 'Dustin', 'Jon', 'Luke', 'Melissa', 'Skyler']);
  const [categories, setCategories] = useState([]);
  const inputRefs = useRef({});

  // Load data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load quizzes
        const loadedQuizzes = await firebaseBackend.getQuizzes();
        setQuizzes(loadedQuizzes);
        
        // Load user names
        const loadedUserNames = await firebaseBackend.getUserNames();
        setUserNames(loadedUserNames);
        
        // Load categories
        const loadedCategories = await firebaseBackend.getCategories();
        setCategories(loadedCategories);
        
        // Check for shared quiz
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('quiz');
        if (shareId) {
          const sharedQuiz = loadedQuizzes.find(q => q.shareId === shareId);
          if (sharedQuiz) {
            setSharedQuizId(shareId);
            setCurrentQuiz(sharedQuiz);
            setViewMode('preview');
            setShowPreview(true);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    
    loadData();
    
    // Check authentication
    const savedAuth = localStorage.getItem('quiz_auth');
    const savedUser = localStorage.getItem('quiz_user');
    if (savedAuth === 'authenticated' && savedUser) {
      setIsAuthenticated(true);
      setCurrentUser(savedUser);
    }
  }, []);  const saveToHistory = useCallback((quiz) => {
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
        if (currentQuiz) addQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, currentQuiz]);

  const autoSave = useCallback((quiz) => {
    if (!autoSaveEnabled) return;
    
    if (saveTimeout) clearTimeout(saveTimeout);
    
    const timeout = setTimeout(async () => {
      try {
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
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 1000);
    
    setSaveTimeout(timeout);
  }, [saveTimeout, autoSaveEnabled]);

  const manualSave = async () => {
    if (!currentQuiz) return;
    
    try {
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
    } catch (error) {
      console.error('Manual save failed:', error);
    }
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

  const createNewQuiz = () => {
    const now = new Date().toISOString();
    const newQuiz = {
      id: Date.now().toString(),
      title: 'Untitled Quiz',
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
    setCurrentQuiz(newQuiz);
    setHistory([JSON.parse(JSON.stringify(newQuiz))]);
    setHistoryIndex(0);
    setIsSaved(false);
    setSidebarOpen(false);
  };

  const updateQuiz = (updates) => {
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
  };

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

  const confirmDeleteQuiz = (quiz) => {
    setShowDeleteConfirm(quiz);
  };

    const deleteQuizConfirmed = async () => {
    if (showDeleteConfirm) {
      try {
        await firebaseBackend.deleteQuiz(showDeleteConfirm.id);
        setQuizzes(prev => prev.filter(q => q.id !== showDeleteConfirm.id));
        if (currentQuiz?.id === showDeleteConfirm.id) {
          setCurrentQuiz(null);
        }
        setShowDeleteConfirm(null);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const addTag = (tag) => {
    if (!tag.trim()) return;
    const tags = currentQuiz.tags || [];
    if (!tags.includes(tag.trim())) {
      updateQuiz({ tags: [...tags, tag.trim()] });
    }
  };

  const removeTag = (tag) => {
    const tags = currentQuiz.tags || [];
    updateQuiz({ tags: tags.filter(t => t !== tag) });
  };

  const getAllCategories = () => {
    const categoriesFromQuizzes = new Set();
    quizzes.forEach(quiz => {
      if (quiz.category) categoriesFromQuizzes.add(quiz.category);
    });
    const allCategories = new Set([...categories, ...categoriesFromQuizzes]);
    return Array.from(allCategories).sort();
  };
  
  const addCategory = async (categoryName) => {
    if (!categoryName.trim()) return;
    
    try {
      const updatedCategories = [...categories, categoryName.trim()];
      await firebaseBackend.saveCategories(updatedCategories);
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };
  
  const addUserName = async (userName) => {
    if (!userName.trim() || userNames.includes(userName.trim())) return;
    
    try {
      const updatedUserNames = [...userNames, userName.trim()];
      await firebaseBackend.saveUserNames(updatedUserNames);
      setUserNames(updatedUserNames);
    } catch (error) {
      console.error('Failed to add user name:', error);
    }
  };
  
  const deleteUserName = async (userName) => {
    if (userNames.length <= 1) return; // Keep at least one user
    
    try {
      const updatedUserNames = userNames.filter(name => name !== userName);
      await firebaseBackend.saveUserNames(updatedUserNames);
      setUserNames(updatedUserNames);
    } catch (error) {
      console.error('Failed to delete user name:', error);
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
    
    try {
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
    } catch (error) {
      console.error('Share URL generation failed:', error);
    }
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
    const sheetName = currentQuiz.title.slice(0, 31).replace(/[:\\/?*\[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `${currentQuiz.title}.xlsx`);
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
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block fixed md:relative inset-0 md:inset-auto z-20 md:z-0 bg-white md:w-64 border-r flex flex-col`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-lg">Quizzes</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {quizzes.map(quiz => (
            <div
              key={quiz.id}
              className={`p-4 border-b hover:bg-gray-50 ${
                currentQuiz?.id === quiz.id ? 'bg-blue-50' : ''
              }`}
            >
              <div
                onClick={() => {
                  setCurrentQuiz(quiz);
                  setHistory([JSON.parse(JSON.stringify(quiz))]);
                  setHistoryIndex(0);
                  setIsSaved(true);
                  setSidebarOpen(false);
                }}
                className="cursor-pointer"
              >
                <div className="font-medium truncate">{quiz.title}</div>
                {quiz.status && (
                  <div className="text-xs text-gray-500 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded ${
                      quiz.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      quiz.status === 'Need Approval' ? 'bg-yellow-100 text-yellow-700' :
                      quiz.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {quiz.status}
                    </span>
                  </div>
                )}
                {quiz.category && (
                  <div className="text-xs text-gray-500 mt-1">{quiz.category}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(quiz.lastModified).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDeleteQuiz(quiz);
                }}
                className="mt-2 text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
        </div>        <div className="p-4 border-t space-y-2">
          <button
            onClick={createNewQuiz}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            New Quiz
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setCurrentUser('');
              localStorage.removeItem('quiz_auth');
              localStorage.removeItem('quiz_user');
            }}
            className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
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
              
              {/* User Greeting - Desktop only, hidden when space is tight */}
              <div className="hidden lg:block relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="text-xl text-gray-700 hover:text-gray-900 transition-colors cursor-pointer focus:outline-none"
                >
                  Hi, {currentUser}
                </button>
                
                {showUserDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowUserDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                      {userNames.map(name => (
                        <button
                          key={name}
                          onClick={() => {
                            setCurrentUser(name);
                            setShowUserDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${
                            name === currentUser ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
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
              
              {/* User Greeting - Desktop only, hidden when space is tight */}
              <div className="hidden lg:block relative mr-4">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="text-xl text-gray-700 hover:text-gray-900 transition-colors cursor-pointer focus:outline-none"
                >
                  Hi, {currentUser}
                </button>
                
                {showUserDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowUserDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                      {userNames.map(name => (
                        <button
                          key={name}
                          onClick={() => {
                            setCurrentUser(name);
                            setShowUserDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${
                            name === currentUser ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

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
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <span className="hidden sm:inline">Preview</span>
                  <span className="sm:hidden">👁</span>
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
                <span className="hidden sm:inline">Download</span>
              </button>
            </>
          )}
        </div>

        {/* Quiz Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentQuiz ? (
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Recently Modified</h2>
              {quizzes.filter(q => q.status !== 'Completed').length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <p className="mb-4">No quizzes yet. Click "New Quiz" to create your first one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
                  {quizzes.filter(q => q.status !== 'Completed').map(quiz => (
                    <div
                      key={quiz.id}
                      onClick={() => {
                        setCurrentQuiz(quiz);
                        setHistory([JSON.parse(JSON.stringify(quiz))]);
                        setHistoryIndex(0);
                        setIsSaved(true);
                      }}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5 border border-gray-200"
                    >
                      <div className="mb-3">
                        <h3 className="font-semibold text-lg truncate mb-2">{quiz.title}</h3>
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                          <span>{quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}</span>
                        </div>
                        {quiz.status && (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            quiz.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            quiz.status === 'Need Approval' ? 'bg-yellow-100 text-yellow-700' :
                            quiz.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {quiz.status}
                          </span>
                        )}
                      </div>
                      {quiz.category && (
                        <div className="text-xs text-gray-500 mb-2">
                          {quiz.category}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 pt-2 border-t">
                        {new Date(quiz.lastModified).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed/Archive Section */}
              {quizzes.filter(q => q.status === 'Completed').length > 0 && (
                <div className="mt-12 pt-8 border-t">
                  <h2 className="text-2xl font-bold mb-6">Completed</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {quizzes.filter(q => q.status === 'Completed').map(quiz => (
                      <div
                        key={quiz.id}
                        onClick={() => {
                          setCurrentQuiz(quiz);
                          setHistory([JSON.parse(JSON.stringify(quiz))]);
                          setHistoryIndex(0);
                          setIsSaved(true);
                        }}
                        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5 border border-gray-200 opacity-75 hover:opacity-100"
                      >
                        <div className="mb-3">
                          <h3 className="font-semibold text-lg truncate mb-2">{quiz.title}</h3>
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>{quiz.questions?.length || 0} question{quiz.questions?.length !== 1 ? 's' : ''}</span>
                          </div>
                          {quiz.status && (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {quiz.status}
                            </span>
                          )}
                        </div>
                        {quiz.category && (
                          <div className="text-xs text-gray-500 mb-2">
                            {quiz.category}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 pt-2 border-t">
                          {new Date(quiz.lastModified).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Toolbar */}
              <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded transition-colors"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={18} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 rounded transition-colors"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo size={18} />
                  </button>
                  <div className="w-px h-6 bg-gray-300 mx-2"></div>
                  <button
                    onClick={manualSave}
                    className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm flex items-center gap-2"
                  >
                    <Check size={16} />
                    Save
                  </button>
                  {showSavedCheck && (
                    <span className="text-green-600 text-sm flex items-center gap-1">
                      <Check size={16} />
                      Saved!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={autoSaveEnabled}
                      onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Auto-save
                  </label>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
                  >
                    Preview
                  </button>
                </div>
              </div>
              {/* Status, Quiz Title and Category */}
              <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={currentQuiz.status || 'Draft'}
                    onChange={(e) => updateQuiz({ status: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="flex-1 px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
