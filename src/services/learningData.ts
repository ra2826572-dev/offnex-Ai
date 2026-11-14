import { LearningCourse } from '../types';

export const INITIAL_COURSES: LearningCourse[] = [
  {
    id: 'course-web-dev',
    title: 'Web Development for Beginners',
    category: 'Programming',
    level: 'Beginner',
    duration: '2h',
    iconName: 'Code',
    badgeColor: 'from-blue-600 to-indigo-600',
    enrolled: true,
    progressPercent: 35,
    lessons: [
      {
        id: 'web-lesson-1',
        title: 'Introduction to HTML5 & Web Structure',
        duration: '15 min',
        summary: 'Learn how browsers parse tags, create semantic trees, and structure content without internet.',
        content: `### HTML5 Fundamentals

HTML (HyperText Markup Language) is the backbone of the web. Every page is a tree of elements.

#### Semantic HTML Elements:
- \`<header>\`: Introductory content or navigational links.
- \`<main>\`: The dominant content of the document.
- \`<section>\`: A standalone portion of content.
- \`<article>\`: Independent, self-contained composition.
- \`<footer>\`: Authorship, copyright, and contact details.

\`\`\`html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>My First Offline Page</title>
  </head>
  <body>
    <header><h1>Welcome to Offline Web</h1></header>
    <main>
      <p>This page loads instantly without cloud dependencies.</p>
    </main>
  </body>
</html>
\`\`\`

#### Key Takeaway:
Always prefer semantic elements like \`<button>\` over \`<div onClick>\` for built-in keyboard navigation and accessibility.`,
        completed: true,
        quiz: [
          {
            id: 'quiz-web-1',
            question: 'Which HTML5 element represents the primary content of the body?',
            options: ['<main>', '<div>', '<section>', '<container>'],
            correctIndex: 0,
            explanation: '<main> specifies the main content of a document and should be unique.',
          },
          {
            id: 'quiz-web-2',
            question: 'Why is semantic HTML critical in modern web applications?',
            options: [
              'It improves accessibility, SEO, and screen-reader parsing.',
              'It reduces server bandwidth costs by 90%.',
              'It is strictly required by browser compilers to run JavaScript.',
              'It encrypts local storage keys automatically.',
            ],
            correctIndex: 0,
            explanation: 'Semantic elements provide meaningful structure for assistive tech and search engines.',
          },
        ],
      },
      {
        id: 'web-lesson-2',
        title: 'Modern CSS & Tailwind Utility Patterns',
        duration: '25 min',
        summary: 'Master Flexbox, Grid, design tokens, and building dark mode interfaces.',
        content: `### CSS Flexbox & Grid Systems

Modern web layouts depend on two layout paradigms:

#### 1. Flexbox (One-dimensional)
Best for navbars, toolbars, and row/column alignment.
\`\`\`css
.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
\`\`\`

#### 2. CSS Grid (Two-dimensional)
Best for dashboard cards, gallery grids, and page layouts.
\`\`\`css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}
\`\`\`

#### Tailwind CSS Utility Approach:
Instead of writing isolated CSS files, utility classes compose styling directly onto elements, reducing dead code and speeding up development.`,
        completed: true,
        quiz: [
          {
            id: 'quiz-web-3',
            question: 'When should you choose CSS Grid over Flexbox?',
            options: [
              'When you need to control layout in both rows and columns simultaneously.',
              'When you only want to align items horizontally in a single bar.',
              'Only when using outdated legacy browsers.',
              'Grid is only for images and cannot arrange text.',
            ],
            correctIndex: 0,
            explanation: 'CSS Grid is inherently two-dimensional (rows and columns), while Flexbox is one-dimensional.',
          },
        ],
      },
      {
        id: 'web-lesson-3',
        title: 'JavaScript Modern ES6+ & Asynchronous Code',
        duration: '30 min',
        summary: 'Promises, Async/Await, Array functional methods, and local storage manipulation.',
        content: `### JavaScript Async/Await & Event Loop

JavaScript is single-threaded with an event loop. Long-running tasks like local database reads or vector math should never block the main thread.

#### Promises & Async/Await:
\`\`\`javascript
async function loadUserData(userId) {
  try {
    const record = await localDb.get('users', userId);
    return record;
  } catch (err) {
    console.error('Local retrieval failed:', err);
    return null;
  }
}
\`\`\`

#### Functional Array Transformations:
\`\`\`javascript
const activeModels = models
  .filter(m => m.isInstalled)
  .map(m => m.name);
\`\`\``,
        completed: false,
        quiz: [
          {
            id: 'quiz-web-4',
            question: 'What is the primary benefit of using async/await over raw callbacks?',
            options: [
              'Cleaner, synchronous-looking syntax that avoids callback hell and simplifies error handling.',
              'It runs JavaScript on multiple CPU threads concurrently.',
              'It automatically connects to remote cloud servers.',
              'It increases memory limits of the browser.',
            ],
            correctIndex: 0,
            explanation: 'Async/await provides readability and standard try/catch blocks for handling promises.',
          },
        ],
      },
      {
        id: 'web-lesson-4',
        title: 'React 19 & Component Architecture',
        duration: '35 min',
        summary: 'State hooks, side-effects, memoization, and building blazing fast offline SPAs.',
        content: `### React 19 State & Lifecycle

React components are pure functions of their props and state.

#### Core Hooks:
1. \`useState\`: Local component state.
2. \`useEffect\`: Managing side-effects (listeners, timers, database sync).
3. \`useMemo\` & \`useCallback\`: Preventing expensive re-computations of vector similarities or heavy filters.

\`\`\`typescript
const [query, setQuery] = useState('');
const filteredNotes = useMemo(() => {
  return notes.filter(n => n.title.toLowerCase().includes(query.toLowerCase()));
}, [notes, query]);
\`\`\``,
        completed: false,
      },
    ],
  },
  {
    id: 'course-ai-basics',
    title: 'AI Basics Made Easy',
    category: 'Artificial Intelligence',
    level: 'Beginner',
    duration: '1.5h',
    iconName: 'Brain',
    badgeColor: 'from-purple-600 to-indigo-600',
    enrolled: true,
    progressPercent: 50,
    lessons: [
      {
        id: 'ai-lesson-1',
        title: 'How Large Language Models Work',
        duration: '20 min',
        summary: 'Understand tokens, transformer architectures, self-attention, and weights.',
        content: `### Understanding Large Language Models

An LLM is a neural network trained to predict the next token in a sequence.

#### Key Concepts:
1. **Tokens:** Sub-word fragments (e.g., "Offline" + "GPT"). A token is ~4 English characters.
2. **Context Window:** The maximum number of tokens a model can hold in working memory at once (e.g., 4K, 8K, 128K).
3. **Quantization:** Compressing 16-bit floating point weights into 4-bit (Q4_K_M) integers to run large models on modest 8GB RAM laptops!
4. **Zero Cloud Requirement:** Once weights are downloaded to your disk, computation happens locally through matrix multiplications on your CPU or GPU.`,
        completed: true,
        quiz: [
          {
            id: 'quiz-ai-1',
            question: 'What is "Quantization" in local AI models like Ollama?',
            options: [
              'Compressing precision of weights (e.g. FP16 to 4-bit) so models fit in local RAM with minimal accuracy loss.',
              'A process that forces AI models to use internet connections.',
              'Encrypting the model so nobody can run it.',
              'Translating Python code to JavaScript.',
            ],
            correctIndex: 0,
            explanation: 'Quantization allows models like Gemma 2 2B or Llama 3.2 3B to run smoothly on laptops with 4-8 GB of RAM.',
          },
        ],
      },
      {
        id: 'ai-lesson-2',
        title: 'Retrieval Augmented Generation (RAG) Explained',
        duration: '25 min',
        summary: 'How to give local AI knowledge from your private PDFs without retraining or fine-tuning.',
        content: `### RAG: The Secret to Document Intelligence

LLMs have knowledge cutoffs and can hallucinate. RAG solves this by providing grounding documents.

#### The 3 RAG Steps:
1. **Chunking:** Break large PDFs into 250-word passages.
2. **Indexing:** Convert text into vector representations or keyword tokens.
3. **Context Injection:** When you ask "What are the GDP projections?", the system retrieves the most relevant chunks and feeds them to the LLM prompt.

Because this happens on your device in OfflineGPT, your private business documents and personal PDFs never touch any remote server!`,
        completed: true,
        quiz: [
          {
            id: 'quiz-ai-2',
            question: 'Why is RAG preferred over fine-tuning for private document Q&A?',
            options: [
              'It provides exact citations, updates instantly when new files are added, and costs almost zero computation.',
              'Fine-tuning is always free and faster than RAG.',
              'RAG requires uploading your documents to public servers.',
              'RAG completely deletes the original document.',
            ],
            correctIndex: 0,
            explanation: 'RAG gives instant ground truth, cites exact pages, and works in real-time on local hardware.',
          },
        ],
      },
      {
        id: 'ai-lesson-3',
        title: 'Prompt Engineering & System Personas',
        duration: '20 min',
        summary: 'Learn how to write system instructions that produce accurate, structured, and hallucination-free answers.',
        content: `### Crafting High-Precision Prompts

A prompt is not just a question; it is an execution context.

#### The CLEAR Framework:
- **C - Context:** Who is the audience? (e.g., "Explain to a beginner").
- **L - Limitations:** "Only use information from the text. If unsure, say 'Not found'."
- **E - Examples:** Provide 1-2 examples of desired output format.
- **A - Action:** "Analyze the following 3 economic indicators."
- **R - Result Format:** "Return output as markdown table or bulleted list."`,
        completed: false,
      },
    ],
  },
  {
    id: 'course-english',
    title: 'English Speaking Practice for Bilinguals',
    category: 'Languages',
    level: 'Beginner',
    duration: '1.5h',
    iconName: 'Mic',
    badgeColor: 'from-emerald-600 to-teal-600',
    enrolled: true,
    progressPercent: 20,
    lessons: [
      {
        id: 'eng-lesson-1',
        title: 'Daily Professional Introductions & Greetings',
        duration: '20 min',
        summary: 'Confidently introduce yourself in job interviews, freelance meetings, and tech pitches.',
        content: `### Mastering Introductions (Urdu to English Guide)

Jab aap kisi client ya interviewer se pehli baar milte hain, to confidence aur clear pronunciation sab se ahem hoti hai.

#### Key Phrases:
- **Instead of:** "Myself Rizwan from Lahore."
- **Use:** "Hello, my name is Rizwan. I'm a full-stack software engineer based in Lahore."

- **Instead of:** "I will try to do this job."
- **Use:** "I am confident I can deliver high-quality results within your timeline."

#### Practice Exercise:
Use the **Voice Assistant** quick tool to record yourself speaking this phrase aloud:
*"Good afternoon! Thank you for having me today. I specialize in building offline-first intelligent web applications."*`,
        completed: true,
        quiz: [
          {
            id: 'quiz-eng-1',
            question: 'Which of the following is the most professional introduction?',
            options: [
              'Good morning, my name is Rizwan and I lead frontend architecture.',
              'Myself Rizwan, I do web things.',
              'I am Rizwan, you can give me any work.',
              'Hey man, what is up?',
            ],
            correctIndex: 0,
            explanation: '"My name is..." is grammatically standard and universally preferred in corporate communication.',
          },
        ],
      },
      {
        id: 'eng-lesson-2',
        title: 'Handling Technical Explanations with Ease',
        duration: '25 min',
        summary: 'Learn how to describe software architecture, bug fixes, and feature proposals.',
        content: `### Explaining Technical Concepts

Use connective words to sound fluent and organized:
1. **"First and foremost..."** (Sab se pehle)
2. **"Consequently..."** (Nateeje ke taur par)
3. **"In comparison to..."** (Is ke muqablay mein)
4. **"To summarize our discussion..."** (Hamari baat cheet ka khulasa yeh hai)`,
        completed: false,
      },
    ],
  },
  {
    id: 'course-python',
    title: 'Python for Data & Automation',
    category: 'Programming',
    level: 'Intermediate',
    duration: '2.5h',
    iconName: 'Terminal',
    badgeColor: 'from-amber-600 to-orange-600',
    enrolled: false,
    progressPercent: 0,
    lessons: [
      {
        id: 'py-lesson-1',
        title: 'Python Data Structures: Lists, Dictionaries, Sets',
        duration: '25 min',
        summary: 'Master collections, list comprehensions, and memory-efficient data slicing.',
        content: `### Python Data Structures

\`\`\`python
# Fast keyword lookup using Python sets
stop_words = {"the", "is", "at", "which", "on"}

tokens = ["offline", "ai", "is", "running", "locally"]
filtered = [w for w in tokens if w not in stop_words]
print(filtered) # ['offline', 'ai', 'running', 'locally']
\`\`\``,
        completed: false,
      },
    ],
  },
];
