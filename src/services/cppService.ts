export interface CppTemplate {
  id: string;
  title: string;
  description: string;
  category: 'starter' | 'competitive' | 'oop' | 'dsa' | 'modern';
  fileName: string;
  code: string;
}

export const CPP_TEMPLATES: CppTemplate[] = [
  {
    id: 'cpp-hello',
    title: 'C++ Hello World',
    description: 'Basic C++20 starter program with standard I/O',
    category: 'starter',
    fileName: 'main.cpp',
    code: `#include <iostream>
#include <string>

int main() {
    std::cout << "========================================" << std::endl;
    std::cout << " Hello from Onyx Code C++ IDE!         " << std::endl;
    std::cout << " C++20 Standard Environment Ready       " << std::endl;
    std::cout << "========================================" << std::endl;

    std::string name;
    std::cout << "Enter your name: ";
    if (std::cin >> name) {
        std::cout << "Welcome, " << name << "! Happy coding." << std::endl;
    }

    return 0;
}
`,
  },
  {
    id: 'cpp-competitive',
    title: 'Competitive Programming (Fast I/O)',
    description: 'Optimized CP template with fast I/O, type aliases, and debug macros',
    category: 'competitive',
    fileName: 'solution.cpp',
    code: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <cmath>

using namespace std;

// Type Aliases
using ll = long long;
using pii = pair<int, int>;
using vi = vector<int>;
using vll = vector<long long>;

// Fast I/O
void fast_io() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);
}

void solve(int tc) {
    int n;
    if (!(cin >> n)) return;

    vi a(n);
    for (int i = 0; i < n; ++i) {
        cin >> a[i];
    }

    sort(a.begin(), a.end());

    ll total = 0;
    for (int x : a) total += x;

    cout << "Case #" << tc << ": Sum = " << total << ", Min = " << a.front() << ", Max = " << a.back() << "\\n";
}

int main() {
    fast_io();

    int test_cases = 1;
    // cin >> test_cases;
    for (int t = 1; t <= test_cases; ++t) {
        solve(t);
    }

    return 0;
}
`,
  },
  {
    id: 'cpp-oop',
    title: 'Object-Oriented C++ Class',
    description: 'Header, Implementation, Encapsulation, Polymorphism, and RAII',
    category: 'oop',
    fileName: 'oop_demo.cpp',
    code: `#include <iostream>
#include <memory>
#include <string>
#include <vector>

// Base Class
class Entity {
protected:
    std::string m_Name;
public:
    Entity(std::string name) : m_Name(std::move(name)) {}
    virtual ~Entity() = default;

    virtual void Display() const {
        std::cout << "[Entity] " << m_Name << std::endl;
    }
};

// Derived Class
class Developer : public Entity {
private:
    std::string m_PrimaryLanguage;
    int m_ExperienceYears;
public:
    Developer(std::string name, std::string lang, int years)
        : Entity(std::move(name)), m_PrimaryLanguage(std::move(lang)), m_ExperienceYears(years) {}

    void Display() const override {
        std::cout << "[Developer] " << m_Name 
                  << " | Language: " << m_PrimaryLanguage 
                  << " | " << m_ExperienceYears << " yrs exp" << std::endl;
    }
};

int main() {
    std::vector<std::unique_ptr<Entity>> team;
    team.push_back(std::make_unique<Developer>("Sourabh", "C++ / TypeScript", 5));
    team.push_back(std::make_unique<Developer>("Alex", "Modern C++20", 3));
    team.push_back(std::make_unique<Developer>("Elena", "Rust / Python", 4));

    std::cout << "--- Engineering Team ---" << std::endl;
    for (const auto& member : team) {
        member->Display();
    }

    return 0;
}
`,
  },
  {
    id: 'cpp-dsa',
    title: 'Data Structures: Binary Search Tree',
    description: 'Generic BST with insertion, search, and in-order traversal',
    category: 'dsa',
    fileName: 'bst.cpp',
    code: `#include <iostream>
#include <memory>

template <typename T>
class BinarySearchTree {
private:
    struct Node {
        T data;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;
        Node(T val) : data(val), left(nullptr), right(nullptr) {}
    };

    std::unique_ptr<Node> root;

    void insert(std::unique_ptr<Node>& node, T val) {
        if (!node) {
            node = std::make_unique<Node>(val);
            return;
        }
        if (val < node->data) insert(node->left, val);
        else insert(node->right, val);
    }

    void inOrder(const Node* node) const {
        if (!node) return;
        inOrder(node->left.get());
        std::cout << node->data << " ";
        inOrder(node->right.get());
    }

public:
    void insert(T val) { insert(root, val); }
    void printInOrder() const {
        inOrder(root.get());
        std::cout << std::endl;
    }
};

int main() {
    BinarySearchTree<int> bst;
    for (int val : {50, 30, 70, 20, 40, 60, 80}) {
        bst.insert(val);
    }

    std::cout << "BST In-Order Traversal (Sorted): ";
    bst.printInOrder();
    return 0;
}
`,
  },
  {
    id: 'cpp-modern',
    title: 'Modern C++20 Features (Ranges & Concepts)',
    description: 'Demonstrating C++20 std::ranges, views, concepts, and format',
    category: 'modern',
    fileName: 'modern_cpp.cpp',
    code: `#include <iostream>
#include <vector>
#include <numeric>
#include <ranges>
#include <concepts>

// C++20 Concept
template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

template <Numeric T>
T calculateSquare(T value) {
    return value * value;
}

int main() {
    std::vector<int> numbers = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    // C++20 Ranges pipeline: filter evens, square them, take first 3
    auto results = numbers 
        | std::views::filter([](int n) { return n % 2 == 0; })
        | std::views::transform([](int n) { return calculateSquare(n); })
        | std::views::take(3);

    std::cout << "C++20 Ranges Transformation (First 3 even squares): ";
    for (int n : results) {
        std::cout << n << " ";
    }
    std::cout << std::endl;

    return 0;
}
`,
  }
];

export function registerCppMonacoSnippets(monaco: any) {
  if (!monaco) return;

  try {
    monaco.languages.registerCompletionItemProvider('cpp', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = [
          {
            label: 'main',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'int main() {\n\t${1}\n\treturn 0;\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Standard int main() entry point',
            range,
          },
          {
            label: 'cout',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::cout << ${1:"Hello World"} << std::endl;',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'std::cout stream output',
            range,
          },
          {
            label: 'cin',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::cin >> ${1:var};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'std::cin stream input',
            range,
          },
          {
            label: 'inc',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '#include <${1:iostream}>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '#include header',
            range,
          },
          {
            label: 'vector',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::vector<${1:int}> ${2:vec};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'std::vector declaration',
            range,
          },
          {
            label: 'fori',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Indexed for loop',
            range,
          },
          {
            label: 'forauto',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'for (const auto& ${1:item} : ${2:container}) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Range-based for loop',
            range,
          },
          {
            label: 'class',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'class ${1:ClassName} {\nprivate:\n\t${2}\npublic:\n\t${1:ClassName}() = default;\n\t~${1:ClassName}() = default;\n};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'C++ Class skeleton',
            range,
          },
          {
            label: 'fastio',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'std::ios_base::sync_with_stdio(false);\nstd::cin.tie(NULL);\nstd::cout.tie(NULL);',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Fast I/O optimization for Competitive Programming',
            range,
          },
        ];

        return { suggestions };
      },
    });
  } catch (err) {
    console.warn('Monaco completion provider registration note:', err);
  }
}
