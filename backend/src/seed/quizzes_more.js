// Extra assessments ported from the web version (MentorLink BD web, server/src/data/skills.ts).
// Same shape as seed/quizzes.js: { skillKey: [{ q, options, answer, topic }] }. `answer` is the index of the right option.
// SQL, Python, Statistics and Git are NOT here: the backend already has its own 8-question quizzes for them.
const MORE_QUIZZES = {
  "powerbi": [
    {
      "q": "Which language do you use to write measures in Power BI?",
      "options": [
        "SQL",
        "DAX",
        "Java",
        "R only"
      ],
      "answer": 1,
      "topic": "DAX"
    },
    {
      "q": "Power Query is mainly used to:",
      "options": [
        "Clean and shape data",
        "Host reports on the web",
        "Draw 3D models",
        "Send emails"
      ],
      "answer": 0,
      "topic": "Data prep"
    },
    {
      "q": "Which visual suits a trend over time best?",
      "options": [
        "Pie chart",
        "Line chart",
        "Treemap",
        "Funnel"
      ],
      "answer": 1,
      "topic": "Visuals"
    },
    {
      "q": "What does a slicer do?",
      "options": [
        "Exports a PDF",
        "Filters the other visuals",
        "Creates a gateway",
        "Writes DAX"
      ],
      "answer": 1,
      "topic": "Visuals"
    },
    {
      "q": "A star schema has:",
      "options": [
        "Only one table",
        "No relationships",
        "A fact table linked to dimension tables",
        "Circular links"
      ],
      "answer": 2,
      "topic": "Modeling"
    },
    {
      "q": "Which file type holds a report you build in Power BI Desktop?",
      "options": [
        "PBIX",
        "XLSX",
        "DOCX",
        "CSV"
      ],
      "answer": 0,
      "topic": "Basics"
    }
  ],
  "programming": [
    {
      "q": "What is an algorithm?",
      "options": [
        "A programming language",
        "A step-by-step procedure to solve a problem",
        "A type of computer",
        "A text editor"
      ],
      "answer": 1,
      "topic": "Algorithms"
    },
    {
      "q": "A variable is best described as:",
      "options": [
        "A fixed number",
        "A named place to store a value",
        "A type of loop",
        "A comment"
      ],
      "answer": 1,
      "topic": "Variables"
    },
    {
      "q": "Which structure repeats code while a condition is true?",
      "options": [
        "if statement",
        "while loop",
        "function definition",
        "comment"
      ],
      "answer": 1,
      "topic": "Control flow"
    },
    {
      "q": "Which structure follows first-in, first-out order?",
      "options": [
        "Stack",
        "Queue",
        "Tree",
        "Set"
      ],
      "answer": 1,
      "topic": "Data structures"
    },
    {
      "q": "What is debugging?",
      "options": [
        "Writing comments",
        "Finding and fixing errors",
        "Installing software",
        "Deleting files"
      ],
      "answer": 1,
      "topic": "Debugging"
    },
    {
      "q": "Which search is faster on a sorted list of 1,000,000 items?",
      "options": [
        "Linear search",
        "Binary search",
        "Both are equal",
        "Neither works"
      ],
      "answer": 1,
      "topic": "Complexity"
    }
  ],
  "mathematics": [
    {
      "q": "If 2x + 6 = 14, what is x?",
      "options": [
        "2",
        "4",
        "6",
        "8"
      ],
      "answer": 1,
      "topic": "Algebra"
    },
    {
      "q": "What is the dot product of [1, 2] and [3, 4]?",
      "options": [
        "10",
        "11",
        "12",
        "14"
      ],
      "answer": 1,
      "topic": "Linear algebra"
    },
    {
      "q": "What is the derivative of x squared?",
      "options": [
        "x",
        "2x",
        "x squared",
        "2"
      ],
      "answer": 1,
      "topic": "Calculus"
    },
    {
      "q": "A derivative of a function tells you its:",
      "options": [
        "Area",
        "Rate of change",
        "Maximum value only",
        "Average"
      ],
      "answer": 1,
      "topic": "Calculus"
    },
    {
      "q": "Which matrix operation requires the inner dimensions to match?",
      "options": [
        "Addition",
        "Multiplication",
        "Transpose",
        "Scalar multiplication"
      ],
      "answer": 1,
      "topic": "Linear algebra"
    },
    {
      "q": "log base 10 of 1000 equals:",
      "options": [
        "2",
        "3",
        "10",
        "100"
      ],
      "answer": 1,
      "topic": "Algebra"
    }
  ],
  "pythondata": [
    {
      "q": "Which call creates an array of zeros with shape (2, 3)?",
      "options": [
        "np.zeros(2, 3)",
        "np.zeros((2, 3))",
        "np.empty(2, 3)",
        "np.array(0, 2, 3)"
      ],
      "answer": 1,
      "topic": "NumPy"
    },
    {
      "q": "What does arr.shape return?",
      "options": [
        "The data type",
        "The dimensions of the array",
        "The sum",
        "The memory address"
      ],
      "answer": 1,
      "topic": "NumPy"
    },
    {
      "q": "Which method shows summary statistics of numeric columns?",
      "options": [
        "df.info()",
        "df.describe()",
        "df.head()",
        "df.shape"
      ],
      "answer": 1,
      "topic": "pandas"
    },
    {
      "q": "How do you select rows where the column age is above 18?",
      "options": [
        "df[df['age'] > 18]",
        "df.where(age > 18)",
        "df.select('age' > 18)",
        "df.age.filter(18)"
      ],
      "answer": 0,
      "topic": "pandas"
    },
    {
      "q": "Which method drops rows with missing values?",
      "options": [
        "df.fillna()",
        "df.dropna()",
        "df.isna()",
        "df.drop()"
      ],
      "answer": 1,
      "topic": "Cleaning"
    },
    {
      "q": "df.groupby('city')['sales'].sum() returns:",
      "options": [
        "Total sales per city",
        "All rows",
        "The first city",
        "Average sales"
      ],
      "answer": 0,
      "topic": "Grouping"
    }
  ],
  "machinelearning": [
    {
      "q": "Predicting house prices is an example of:",
      "options": [
        "Classification",
        "Regression",
        "Clustering",
        "Reinforcement learning"
      ],
      "answer": 1,
      "topic": "Basics"
    },
    {
      "q": "Why do we split data into train and test sets?",
      "options": [
        "To make training faster",
        "To check performance on unseen data",
        "To remove outliers",
        "To reduce columns"
      ],
      "answer": 1,
      "topic": "Evaluation"
    },
    {
      "q": "A model with very high training accuracy but low test accuracy is:",
      "options": [
        "Underfitting",
        "Overfitting",
        "Perfect",
        "Unbiased"
      ],
      "answer": 1,
      "topic": "Overfitting"
    },
    {
      "q": "Which algorithm groups unlabeled data into clusters?",
      "options": [
        "Linear regression",
        "K-means",
        "Logistic regression",
        "Naive Bayes"
      ],
      "answer": 1,
      "topic": "Algorithms"
    },
    {
      "q": "For a spam filter, which metric shows how many emails predicted as spam really were spam?",
      "options": [
        "Recall",
        "Precision",
        "MSE",
        "R-squared"
      ],
      "answer": 1,
      "topic": "Evaluation"
    },
    {
      "q": "Why scale features before k-nearest neighbours?",
      "options": [
        "To make labels numeric",
        "So no feature dominates the distance",
        "To remove missing values",
        "To add rows"
      ],
      "answer": 1,
      "topic": "Preprocessing"
    }
  ],
  "htmlcss": [
    {
      "q": "Which tag creates the largest heading?",
      "options": [
        "<h6>",
        "<h1>",
        "<head>",
        "<title>"
      ],
      "answer": 1,
      "topic": "HTML"
    },
    {
      "q": "Which attribute gives an image alternative text?",
      "options": [
        "title",
        "alt",
        "src",
        "name"
      ],
      "answer": 1,
      "topic": "HTML"
    },
    {
      "q": "Which CSS property changes text color?",
      "options": [
        "font-color",
        "color",
        "text-style",
        "foreground"
      ],
      "answer": 1,
      "topic": "CSS"
    },
    {
      "q": "Which declaration turns an element into a flex container?",
      "options": [
        "display: flex",
        "flex: container",
        "position: flex",
        "layout: flex"
      ],
      "answer": 0,
      "topic": "Layout"
    },
    {
      "q": "Which feature applies styles only above a certain screen width?",
      "options": [
        "@media query",
        "@import",
        "!important",
        "z-index"
      ],
      "answer": 0,
      "topic": "Responsive"
    },
    {
      "q": "From inside to outside, the box model order is:",
      "options": [
        "content, padding, border, margin",
        "margin, border, padding, content",
        "content, margin, padding, border",
        "padding, content, border, margin"
      ],
      "answer": 0,
      "topic": "Box model"
    }
  ],
  "javascript": [
    {
      "q": "Which keyword declares a block-scoped variable that can be reassigned?",
      "options": [
        "var",
        "let",
        "const",
        "static"
      ],
      "answer": 1,
      "topic": "Variables"
    },
    {
      "q": "What does typeof null return?",
      "options": [
        "null",
        "object",
        "undefined",
        "number"
      ],
      "answer": 1,
      "topic": "Types"
    },
    {
      "q": "What does [1, 2, 3].map(x => x * 2) return?",
      "options": [
        "[2, 4, 6]",
        "[1, 2, 3]",
        "6",
        "[1, 4, 9]"
      ],
      "answer": 0,
      "topic": "Functions"
    },
    {
      "q": "Which operator compares value and type?",
      "options": [
        "==",
        "===",
        "=",
        "!="
      ],
      "answer": 1,
      "topic": "Operators"
    },
    {
      "q": "What does await do inside an async function?",
      "options": [
        "Stops the whole program",
        "Waits for a promise to resolve",
        "Creates a thread",
        "Declares a variable"
      ],
      "answer": 1,
      "topic": "Async"
    },
    {
      "q": "Which method finds an element by its id?",
      "options": [
        "document.getElementById",
        "document.findId",
        "window.id",
        "document.query(id)"
      ],
      "answer": 0,
      "topic": "DOM"
    }
  ],
  "networking": [
    {
      "q": "Which OSI layer handles IP addressing and routing?",
      "options": [
        "Data link",
        "Network",
        "Transport",
        "Application"
      ],
      "answer": 1,
      "topic": "Models"
    },
    {
      "q": "Which protocol translates domain names to IP addresses?",
      "options": [
        "DHCP",
        "DNS",
        "FTP",
        "SMTP"
      ],
      "answer": 1,
      "topic": "Services"
    },
    {
      "q": "How many bits are in an IPv4 address?",
      "options": [
        "16",
        "32",
        "64",
        "128"
      ],
      "answer": 1,
      "topic": "Addressing"
    },
    {
      "q": "Which protocol assigns IP addresses automatically?",
      "options": [
        "DNS",
        "DHCP",
        "ARP",
        "ICMP"
      ],
      "answer": 1,
      "topic": "Services"
    },
    {
      "q": "Which device forwards packets between different networks?",
      "options": [
        "Switch",
        "Router",
        "Hub",
        "Repeater"
      ],
      "answer": 1,
      "topic": "Devices"
    },
    {
      "q": "Which transport protocol gives reliable, ordered delivery?",
      "options": [
        "UDP",
        "TCP",
        "IP",
        "ICMP"
      ],
      "answer": 1,
      "topic": "Transport"
    }
  ],
  "cybersecurity": [
    {
      "q": "What does the CIA triad stand for?",
      "options": [
        "Confidentiality, Integrity, Availability",
        "Control, Identity, Access",
        "Cryptography, Intrusion, Authentication",
        "Code, Input, Audit"
      ],
      "answer": 0,
      "topic": "Basics"
    },
    {
      "q": "Which attack tricks people into giving passwords through fake messages?",
      "options": [
        "Phishing",
        "DDoS",
        "Port scanning",
        "Brute force"
      ],
      "answer": 0,
      "topic": "Threats"
    },
    {
      "q": "Which attack injects malicious SQL through input fields?",
      "options": [
        "XSS",
        "SQL injection",
        "CSRF",
        "Phishing"
      ],
      "answer": 1,
      "topic": "Web"
    },
    {
      "q": "Which of these is a hashing algorithm, not encryption?",
      "options": [
        "AES",
        "SHA-256",
        "RSA",
        "Caesar cipher"
      ],
      "answer": 1,
      "topic": "Crypto"
    },
    {
      "q": "What does multi-factor authentication add?",
      "options": [
        "A second proof of identity",
        "A longer password only",
        "Faster login",
        "Network speed"
      ],
      "answer": 0,
      "topic": "Defense"
    },
    {
      "q": "Why should software be patched promptly?",
      "options": [
        "To fix known vulnerabilities",
        "To change the look",
        "To free disk space",
        "To rename files"
      ],
      "answer": 0,
      "topic": "Practice"
    }
  ],
  "clouddevops": [
    {
      "q": "Which service model gives you virtual machines to manage yourself?",
      "options": [
        "SaaS",
        "IaaS",
        "PaaS",
        "FaaS"
      ],
      "answer": 1,
      "topic": "Cloud"
    },
    {
      "q": "What does a Docker image contain?",
      "options": [
        "Only logs",
        "The app and its dependencies, ready to run as a container",
        "A virtual keyboard",
        "A database backup only"
      ],
      "answer": 1,
      "topic": "Containers"
    },
    {
      "q": "What does CI stand for?",
      "options": [
        "Continuous Integration",
        "Cloud Instance",
        "Container Image",
        "Central Index"
      ],
      "answer": 0,
      "topic": "CI/CD"
    },
    {
      "q": "Which command lists files in a directory?",
      "options": [
        "ls",
        "cd",
        "rm",
        "cat"
      ],
      "answer": 0,
      "topic": "Linux"
    },
    {
      "q": "Infrastructure as Code means:",
      "options": [
        "Managing infrastructure with versioned config files",
        "Writing code on servers by hand",
        "Buying hardware",
        "Using only GUIs"
      ],
      "answer": 0,
      "topic": "IaC"
    },
    {
      "q": "Kubernetes is mainly used to:",
      "options": [
        "Edit images",
        "Orchestrate containers at scale",
        "Write SQL",
        "Design logos"
      ],
      "answer": 1,
      "topic": "Orchestration"
    }
  ],
  "uiux": [
    {
      "q": "What is the main goal of user research?",
      "options": [
        "Choose colors",
        "Understand users' needs and behaviour",
        "Write code faster",
        "Reduce server cost"
      ],
      "answer": 1,
      "topic": "Research"
    },
    {
      "q": "A wireframe is:",
      "options": [
        "A low-fidelity layout of a screen",
        "A finished visual design",
        "A database diagram",
        "A test report"
      ],
      "answer": 0,
      "topic": "Design"
    },
    {
      "q": "Which is one of Nielsen's usability heuristics?",
      "options": [
        "Visibility of system status",
        "Use as many colors as possible",
        "Hide error messages",
        "Avoid feedback"
      ],
      "answer": 0,
      "topic": "Usability"
    },
    {
      "q": "Which choice harms accessibility?",
      "options": [
        "Light grey text on a white background",
        "Dark text on a white background",
        "Black text on yellow",
        "Dark blue text on white"
      ],
      "answer": 0,
      "topic": "Accessibility"
    },
    {
      "q": "Why test a prototype with real users?",
      "options": [
        "To find problems before building",
        "To increase page size",
        "To avoid research",
        "To skip design"
      ],
      "answer": 0,
      "topic": "Testing"
    },
    {
      "q": "Information architecture is about:",
      "options": [
        "Organizing and labeling content",
        "Choosing fonts only",
        "Server setup",
        "Animation speed"
      ],
      "answer": 0,
      "topic": "Structure"
    }
  ],
  "digitalmarketing": [
    {
      "q": "What does SEO stand for?",
      "options": [
        "Search Engine Optimization",
        "Social Engagement Order",
        "Site Experience Overview",
        "Sales Email Outreach"
      ],
      "answer": 0,
      "topic": "SEO"
    },
    {
      "q": "Click-through rate (CTR) is:",
      "options": [
        "Clicks divided by impressions",
        "Impressions divided by clicks",
        "Sales divided by clicks",
        "Visits divided by followers"
      ],
      "answer": 0,
      "topic": "Metrics"
    },
    {
      "q": "Content marketing means:",
      "options": [
        "Creating useful content to attract and keep an audience",
        "Sending the same ad to everyone",
        "Buying email lists",
        "Changing prices daily"
      ],
      "answer": 0,
      "topic": "Content"
    },
    {
      "q": "Which is a good email marketing practice?",
      "options": [
        "Get permission before sending",
        "Hide the unsubscribe link",
        "Send daily to everyone",
        "Use misleading subject lines"
      ],
      "answer": 0,
      "topic": "Email"
    },
    {
      "q": "In pay-per-click advertising, you pay when:",
      "options": [
        "Someone clicks your ad",
        "Your ad is created",
        "Someone sees the ad once",
        "A sale always happens"
      ],
      "answer": 0,
      "topic": "Paid"
    },
    {
      "q": "A conversion is:",
      "options": [
        "A visitor completing a desired action",
        "Any page visit",
        "A social media follow only",
        "A server error"
      ],
      "answer": 0,
      "topic": "Analytics"
    }
  ],
  "graphicdesign": [
    {
      "q": "Which principle guides the viewer's eye to the most important element?",
      "options": [
        "Hierarchy",
        "Repetition only",
        "Noise",
        "Kerning"
      ],
      "answer": 0,
      "topic": "Principles"
    },
    {
      "q": "Which color model is used for screens?",
      "options": [
        "RGB",
        "CMYK",
        "Pantone only",
        "Greyscale only"
      ],
      "answer": 0,
      "topic": "Color"
    },
    {
      "q": "Kerning refers to:",
      "options": [
        "Space between specific letter pairs",
        "Line height",
        "Font weight",
        "Paragraph alignment"
      ],
      "answer": 0,
      "topic": "Typography"
    },
    {
      "q": "Which format keeps sharp edges at any size?",
      "options": [
        "SVG (vector)",
        "JPEG",
        "BMP",
        "GIF"
      ],
      "answer": 0,
      "topic": "Formats"
    },
    {
      "q": "Which color model is standard for print?",
      "options": [
        "CMYK",
        "RGB",
        "HSL only",
        "Web safe"
      ],
      "answer": 0,
      "topic": "Print"
    },
    {
      "q": "White space helps a design by:",
      "options": [
        "Improving clarity and focus",
        "Wasting paper",
        "Reducing contrast",
        "Hiding the message"
      ],
      "answer": 0,
      "topic": "Layout"
    }
  ],
  "appdev": [
    {
      "q": "Which language does Flutter use?",
      "options": [
        "Dart",
        "Swift",
        "Kotlin",
        "Ruby"
      ],
      "answer": 0,
      "topic": "Basics"
    },
    {
      "q": "Which language does Google prefer for Android development?",
      "options": [
        "Kotlin",
        "Pascal",
        "Perl",
        "COBOL"
      ],
      "answer": 0,
      "topic": "Android"
    },
    {
      "q": "In mobile UI, what is a widget or component?",
      "options": [
        "A reusable piece of the interface",
        "A database",
        "A server",
        "A compiler"
      ],
      "answer": 0,
      "topic": "UI"
    },
    {
      "q": "State management is about:",
      "options": [
        "Keeping the UI in sync with changing data",
        "Choosing app icons",
        "Selling the app",
        "Compressing images"
      ],
      "answer": 0,
      "topic": "State"
    },
    {
      "q": "Which format do most REST APIs use to send data?",
      "options": [
        "JSON",
        "BMP",
        "MP3",
        "PSD"
      ],
      "answer": 0,
      "topic": "APIs"
    },
    {
      "q": "Where are Android apps published?",
      "options": [
        "Google Play Console",
        "npm",
        "GitHub Pages",
        "Docker Hub"
      ],
      "answer": 0,
      "topic": "Publishing"
    }
  ]
};
// [key, English name, Bangla name, learning hours]
const MORE_SKILLS = [
  [
    "powerbi",
    "Power BI",
    "পাওয়ার বিআই",
    20
  ],
  [
    "programming",
    "Programming Fundamentals",
    "প্রোগ্রামিং মৌলিক",
    30
  ],
  [
    "mathematics",
    "Mathematics",
    "গণিত",
    40
  ],
  [
    "pythondata",
    "Data Analysis with Python",
    "পাইথনে ডেটা বিশ্লেষণ",
    30
  ],
  [
    "machinelearning",
    "Machine Learning",
    "মেশিন লার্নিং",
    60
  ],
  [
    "htmlcss",
    "HTML & CSS",
    "এইচটিএমএল ও সিএসএস",
    20
  ],
  [
    "javascript",
    "JavaScript",
    "জাভাস্ক্রিপ্ট",
    35
  ],
  [
    "networking",
    "Networking",
    "নেটওয়ার্কিং",
    30
  ],
  [
    "cybersecurity",
    "Cybersecurity",
    "সাইবার নিরাপত্তা",
    40
  ],
  [
    "clouddevops",
    "Cloud & DevOps",
    "ক্লাউড ও ডেভঅপস",
    40
  ],
  [
    "uiux",
    "UI/UX Design",
    "ইউআই/ইউএক্স ডিজাইন",
    30
  ],
  [
    "digitalmarketing",
    "Digital Marketing",
    "ডিজিটাল মার্কেটিং",
    25
  ],
  [
    "graphicdesign",
    "Graphic Design",
    "গ্রাফিক ডিজাইন",
    30
  ],
  [
    "appdev",
    "App Development",
    "অ্যাপ ডেভেলপমেন্ট",
    40
  ]
];
module.exports = { MORE_QUIZZES, MORE_SKILLS };
