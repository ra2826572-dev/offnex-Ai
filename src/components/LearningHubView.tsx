'use client';

import React, { useState } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Play, 
  CheckCircle2, 
  HelpCircle, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  ArrowLeft,
  Award,
  Bookmark,
  Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LearningCourse, CourseLesson } from '../types';
import { INITIAL_COURSES } from '../services/learningData';

interface LearningHubViewProps {
  onAskTutor: (topic: string, question: string) => void;
}

export const LearningHubView: React.FC<LearningHubViewProps> = ({ onAskTutor }) => {
  const [courses, setCourses] = useState<LearningCourse[]>(INITIAL_COURSES);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [hubTab, setHubTab] = useState<'courses' | 'topics' | 'quizzes'>('courses');
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizCompleted, setQuizCompleted] = useState<Record<string, boolean>>({});

  const activeCourse = courses.find(c => c.id === activeCourseId);
  const activeLesson = activeCourse?.lessons.find(l => l.id === activeLessonId) || activeCourse?.lessons[0];

  const handleCompleteLesson = (lessonId: string) => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    setCourses(prev =>
      prev.map(c => {
        if (c.id !== activeCourseId) return c;
        const updatedLessons = c.lessons.map(l =>
          l.id === lessonId ? { ...l, completed: true } : l
        );
        const completedCount = updatedLessons.filter(l => l.completed).length;
        const progress = Math.round((completedCount / updatedLessons.length) * 100);
        return {
          ...c,
          lessons: updatedLessons,
          progressPercent: progress,
        };
      })
    );
  };

  const handleAnswerQuiz = (qId: string, optIdx: number, correctIdx: number) => {
    setQuizAnswers(prev => ({ ...prev, [qId]: optIdx }));
    if (optIdx === correctIdx) {
      setQuizCompleted(prev => ({ ...prev, [qId]: true }));
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0D18] overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-[#1F243D] bg-[#0E1020]/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {activeCourse ? (
            <button
              onClick={() => {
                setActiveCourseId(null);
                setActiveLessonId(null);
              }}
              className="p-1.5 rounded-lg bg-[#181D35] hover:bg-[#222846] text-gray-300 hover:text-white transition-colors flex items-center gap-1 text-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Courses</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white">Learning Hub</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                👑 Pro Access
              </span>
            </div>
          )}
        </div>

        {/* Tab pills */}
        {!activeCourse && (
          <div className="flex items-center gap-1.5 bg-[#14182E] p-1 rounded-xl border border-[#232948]">
            {(['courses', 'topics', 'quizzes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setHubTab(tab)}
                className={`px-3.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  hubTab === tab
                    ? 'bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {!activeCourse ? (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[#171B36] via-[#1E2448] to-[#14182E] border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-white">Master In-Demand Skills 100% Offline</h3>
                <p className="text-xs text-gray-300 mt-1 max-w-lg">
                  Every lesson, code snippet, and practice exercise runs locally on your machine with step-by-step AI tutoring.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[#0F1224] px-4 py-2 rounded-xl border border-purple-500/30 shrink-0">
                <Award className="w-5 h-5 text-amber-400" />
                <div className="text-left">
                  <div className="text-xs font-bold text-white">Offline Verified</div>
                  <div className="text-[10px] text-gray-400">Zero internet required</div>
                </div>
              </div>
            </div>

            {/* Courses List matching Screenshot 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => {
                    setActiveCourseId(course.id);
                    setActiveLessonId(course.lessons[0]?.id || null);
                  }}
                  className="group p-4 rounded-2xl bg-[#14182D] border border-[#232948] hover:border-purple-500/40 hover:bg-[#181D35] transition-all cursor-pointer shadow-lg space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-500/20">
                        {course.category}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{course.duration}</span>
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {course.title}
                    </h4>
                    <p className="text-xs text-gray-400">
                      {course.lessons.length} Lessons • {course.level}
                    </p>
                  </div>

                  {/* Progress Bar & Play Button */}
                  <div className="space-y-2 pt-2 border-t border-[#1F2542]">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Progress</span>
                      <span className="text-purple-300 font-bold">{course.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-[#0E1122] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${course.progressPercent}%` }}
                      />
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-300 font-medium">Continue Course</span>
                      <div className="w-8 h-8 rounded-full bg-purple-600/30 group-hover:bg-purple-600 border border-purple-500/40 flex items-center justify-center text-white transition-colors shadow-sm">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Active Course Lesson Reader & AI Tutor Workspace */
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Lessons Table of Contents */}
            <div className="space-y-2 lg:col-span-1">
              <div className="p-3 bg-[#14182D] rounded-xl border border-[#232948]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Course Lessons ({activeCourse.lessons.length})
                </h3>
                <div className="space-y-1">
                  {activeCourse.lessons.map((lesson, idx) => {
                    const isSelected = lesson.id === activeLesson?.id;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLessonId(lesson.id)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white font-semibold shadow-md'
                            : 'text-gray-300 hover:bg-[#1A203C]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="opacity-60">{idx + 1}.</span>
                          <span className="truncate">{lesson.title}</span>
                        </div>
                        {lesson.completed && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ask Offline AI Tutor Box */}
              <div className="p-3.5 bg-[#14182D] rounded-xl border border-purple-500/30 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Ask Offline AI Tutor</span>
                </div>
                <input
                  type="text"
                  value={tutorQuestion}
                  onChange={(e) => setTutorQuestion(e.target.value)}
                  placeholder="Need something explained?"
                  className="w-full bg-[#1A1F38] border border-[#272E50] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tutorQuestion.trim() && activeLesson) {
                      onAskTutor(activeLesson.title, tutorQuestion.trim());
                      setTutorQuestion('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (tutorQuestion.trim() && activeLesson) {
                      onAskTutor(activeLesson.title, tutorQuestion.trim());
                      setTutorQuestion('');
                    }
                  }}
                  className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Explain Step by Step
                </button>
              </div>
            </div>

            {/* Right: Active Lesson Content & Interactive Quiz */}
            <div className="lg:col-span-2 space-y-6">
              {activeLesson ? (
                <div className="p-6 rounded-2xl bg-[#14182D] border border-[#232948] space-y-5">
                  <div className="flex items-center justify-between border-b border-[#202646] pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{activeLesson.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{activeLesson.duration} read • Offline syllabus</p>
                    </div>
                    {activeLesson.completed ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCompleteLesson(activeLesson.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-sm cursor-pointer"
                      >
                        Mark as Complete
                      </button>
                    )}
                  </div>

                  {/* Lesson Markdown Content */}
                  <div className="prose prose-invert max-w-none text-xs md:text-sm text-gray-200 leading-relaxed space-y-3 font-sans">
                    <p className="text-gray-300 italic border-l-2 border-purple-500 pl-3">
                      {activeLesson.summary}
                    </p>
                    <div className="whitespace-pre-line">{activeLesson.content}</div>
                  </div>

                  {/* Practice Quiz Section */}
                  {activeLesson.quiz && activeLesson.quiz.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-[#202646] space-y-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-400" />
                        <span>Interactive Comprehension Quiz</span>
                      </h4>

                      <div className="space-y-4">
                        {activeLesson.quiz.map((q, qIdx) => {
                          const selectedOpt = quizAnswers[q.id];
                          const isCorrect = selectedOpt === q.correctIndex;
                          const hasAnswered = selectedOpt !== undefined;

                          return (
                            <div key={q.id} className="p-4 rounded-xl bg-[#101326] border border-[#232948] space-y-3">
                              <p className="text-xs md:text-sm font-medium text-white">
                                {qIdx + 1}. {q.question}
                              </p>
                              <div className="space-y-1.5">
                                {q.options.map((opt, optIdx) => {
                                  const isThisSelected = selectedOpt === optIdx;
                                  let btnClass = 'bg-[#181D35] border-[#252B4D] text-gray-300 hover:bg-[#202648]';
                                  if (isThisSelected) {
                                    btnClass = isCorrect
                                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-semibold'
                                      : 'bg-rose-950/40 border-rose-500 text-rose-300 font-semibold';
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      onClick={() => handleAnswerQuiz(q.id, optIdx, q.correctIndex)}
                                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${btnClass}`}
                                    >
                                      <span>{opt}</span>
                                      {isThisSelected && isCorrect && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              {hasAnswered && (
                                <p className="text-xs text-gray-400 bg-[#161B33] p-2.5 rounded-lg border border-purple-500/20">
                                  💡 <span className="text-purple-300 font-semibold">Explanation:</span> {q.explanation}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
