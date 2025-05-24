# CTRL-P Dashboard - Modular Electron Application

A modern, modular Electron application for print shop management with enhanced code organization, maintainability, and scalability.

## 🏗️ Architecture Overview

This application follows a modular architecture pattern with clear separation of concerns:

### 📁 Project Structure

\`\`\`
ctrlp-dashboard/
├── src/
│   ├── main/
│   │   ├── modules/
│   │   │   ├── auth/              # Authentication & session management
│   │   │   ├── printer/           # Printer detection & management
│   │   │   ├── job/               # Job scheduling & processing
│   │   │   ├── storage/           # File operations & Supabase
│   │   │   ├── websocket/         # Real-time communication
│   │   │   ├── metrics/           # Application metrics
│   │   │   ├── kyc/               # KYC & shop management
│   │   │   └── updater/           # Auto-update functionality
│   │   ├── main.js                # Application entry point
│   │   └── constants.js           # Application constants
│   └── renderer/
│       ├── index.html             # Main UI template
│       ├── main.js                # Renderer process logic
│       └── styles.css             # Application styles
├── package.json
├── README.md
└── .gitignore
\`\`\`

## 🎯 Key Features

### ✅ Modular Design
- **Separation of Concerns**: Each module handles a specific responsibility
- **Loose Coupling**: Modules interact through well-defined interfaces
- **Reusability**: Components designed for easy reuse and extension
- **Maintainability**: Clear naming conventions and consistent coding style

### 🔧 Core Modules

#### 🔐 Authentication Module (`auth/`)
- User login/logout functionality
- Session management with encryption
- Test user support
- Automatic session restoration

#### 🖨️ Printer Module (`printer/`)
- Multi-platform printer detection
- Capability detection (color, duplex, paper sizes)
- Printer queue management
- Real-time printer monitoring

#### 📋 Job Module (`job/`)
- Intelligent job scheduling
- Print queue processing
- Job history tracking
- Paper level management

#### 💾 Storage Module (`storage/`)
- File operations management
- Supabase integration
- Metrics persistence
- Temporary file handling

#### 🌐 WebSocket Module (`websocket/`)
- Real-time server communication
- Job status updates
- Connection management
- Error handling

#### 📊 Metrics Module (`metrics/`)
- Application analytics
- Daily metrics tracking
- Performance monitoring
- Revenue tracking

#### 📄 KYC Module (`kyc/`)
- Know Your Customer data management
- Document upload handling
- Shop information management
- Compliance tracking

#### 🔄 Updater Module (`updater/`)
- Automatic application updates
- GitHub integration
- Update notifications
- Rollback support

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kurama07a/ctrlp-dashboard.git
   cd ctrlp-dashboard