# Sora iOS App - Setup Guide

This guide provides everything you need to build the Sora iOS app using Swift, SwiftUI, and the Convex backend.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Folder Structure](#folder-structure)
- [Convex Integration](#convex-integration)
- [Authentication](#authentication)
- [Books Feature Implementation](#books-feature-implementation)
- [Testing](#testing)
- [Next Steps](#next-steps)

---

## Overview

**Sora iOS** is a native Swift/SwiftUI app that connects to the existing Convex backend. The iOS app shares the **same Convex functions** as the web app, following a backend-heavy architecture where all business logic lives in Convex.

**Architecture:**
```
iOS App (SwiftUI) → Convex Functions → Convex Database
Web App (React)   → Convex Functions → Convex Database
```

**Tech Stack:**
- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Backend Client**: Convex Swift SDK
- **Authentication**: Auth0 (OAuth2/OIDC, same as web app)
- **Minimum iOS Version**: iOS 17.4+ (for Universal Links support)

---

## Prerequisites

1. **Xcode 15+** installed
2. **Swift Package Manager** (built into Xcode)
3. **Apple Developer Account** (for Universal Links in production)
4. **Auth0 Account** with Native application created
5. **Convex Deployment URL**: `https://hallowed-aardvark-843.convex.cloud`
6. Basic understanding of SwiftUI and async/await patterns

---

## Quick Start Summary

Before you start coding, you'll need to configure Auth0:

1. **Create `Auth0.plist`** with your Auth0 domain and client ID
2. **Configure callback URLs** in Auth0 Dashboard (must match your bundle ID)
3. **Use the same Auth0 application** as your web app (for shared user accounts)

The iOS app uses **Auth0 Universal Login** (same as the web app), so users can sign in with the same credentials across both platforms.

**Authentication Flow:**
```
User taps "Login" → Auth0 Universal Login (web view) →
Returns ID token → Pass to Convex → Authenticated!
```

---

## Project Setup

### 1. Create New iOS Project (done)

1. Open Xcode
2. Create new project: **App** template
3. Product Name: `Sora`
4. Interface: **SwiftUI**
5. Language: **Swift**
6. Minimum Deployment: **iOS 18.0**

### 2. Add Required Swift Packages

**Auth0 SDK** (already installed):
- Repository: `https://github.com/auth0/Auth0.swift`
- Version: `~> 2.0`
- Added to target: `Sora`

**Convex Swift SDK** (already installed):
1. In Xcode: **File** → **Add Package Dependencies**
2. Enter repository URL: `https://github.com/get-convex/convex-swift`
3. Select **Up to Next Major Version**: `0.9.0` (or latest)
4. Add to target: `Sora`

### 3. Configure Auth0

#### 3.1. Create Auth0.plist

Create a new file `Auth0.plist` in your Xcode project with the following content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ClientId</key>
    <string>YOUR_AUTH0_CLIENT_ID</string>
    <key>Domain</key>
    <string>YOUR_AUTH0_DOMAIN</string>
</dict>
</plist>
```

**Replace with your values:**
- `YOUR_AUTH0_CLIENT_ID`: Your Auth0 application client ID (e.g., `dnhDcQV8OqcNnDGi5nNEqJoKmsFVxPE1`)
- `YOUR_AUTH0_DOMAIN`: Your Auth0 tenant domain (e.g., `jereswinnen.eu.auth0.com`)

**⚠️ Important:** Ensure the `Auth0.plist` file is added to your app target in Xcode (check the target membership in the file inspector).

#### 3.2. Configure Callback URLs in Auth0 Dashboard

1. Go to [Auth0 Dashboard](https://manage.auth0.com) → Applications → Applications
2. Select your Native application (or create one)
3. Configure the following URLs:

**Allowed Callback URLs:**
```
YOUR_BUNDLE_IDENTIFIER://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback
```

**Allowed Logout URLs:**
```
YOUR_BUNDLE_IDENTIFIER://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback
```

**Example** (if your bundle ID is `com.yourname.Sora` and domain is `dev-abc123.us.auth0.com`):
```
com.yourname.Sora://dev-abc123.us.auth0.com/ios/com.yourname.Sora/callback
```

4. Save changes

#### 3.3. Configure Universal Links (Production - Optional for Development)

For production apps, configure Universal Links to avoid the permission alert:

1. **In Auth0 Dashboard**, add to Allowed Callback URLs:
```
https://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback
```

2. **In Xcode**, add Associated Domains capability:
   - Select your app target → Signing & Capabilities
   - Click "+ Capability" → Associated Domains
   - Add: `webcredentials:YOUR_AUTH0_DOMAIN`

**Note:** Universal Links require a paid Apple Developer account and iOS 17.4+. For development, you can skip this and use custom URL schemes (with the permission alert).

---

## Folder Structure

Organize your project with the following structure:

```
Sora/
├── SoraApp.swift                  # App entry point
├── Core/
│   ├── Auth/
│   │   └── AuthService.swift      # Auth0 authentication manager
│   ├── Convex/
│   │   ├── ConvexClient.swift     # Singleton Convex client with Auth0
│   │   └── ConvexAPI.swift        # Generated API types
│   └── Extensions/
│       └── Date+Extensions.swift
├── Models/
│   ├── Book.swift                 # Book model matching Convex schema
│   ├── Article.swift              # Article model (future)
│   └── User.swift                 # User model
├── ViewModels/
│   ├── BooksViewModel.swift       # Books list & state management
│   └── AuthViewModel.swift        # Authentication state wrapper
├── Views/
│   ├── Auth/
│   │   ├── AuthenticatedView.swift    # Main view for logged-in users
│   │   └── UnauthenticatedView.swift  # Login screen
│   ├── Books/
│   │   ├── BooksListView.swift    # Main books list
│   │   ├── BookRowView.swift      # Single book row
│   │   ├── BookDetailView.swift   # Book detail screen
│   │   └── AddBookView.swift      # Add new book
│   └── Shared/
│       ├── LoadingView.swift
│       ├── ErrorView.swift
│       └── ProfileCard.swift      # User profile display
└── Resources/
    ├── Assets.xcassets
    └── Auth0.plist                # Auth0 configuration
```

---

## Convex Integration

### 1. Create ConvexClient Singleton with Auth0

**File**: `Core/Convex/ConvexClient.swift`

```swift
import Foundation
import Convex

/// Singleton Convex client for the entire app
/// Handles connection to the Convex backend with Auth0 authentication
class ConvexClient: ObservableObject {
    static let shared = ConvexClient()

    /// The Convex client instance
    let client: Client

    /// Convex deployment URL
    private let deploymentURL = "https://hallowed-aardvark-843.convex.cloud"

    private init() {
        // Initialize Convex client with deployment URL
        self.client = Client(deploymentUrl: deploymentURL)
    }

    /// Set Auth0 ID token for Convex authentication
    /// This token is validated by Convex using auth.config.ts
    func setAuth0Token(_ idToken: String) async {
        // Set the Auth0 ID token as the auth token for Convex
        // Convex will validate this token using the JWT provider configuration
        client.setAuth(idToken)
    }

    /// Clear authentication token on logout
    func clearAuth() {
        client.clearAuth()
    }
}
```

**How it works:**
1. Auth0 issues an ID token after successful login
2. The ID token is passed to Convex via `setAuth0Token()`
3. Convex validates the token using `convex/auth.config.ts` (same as web app)
4. User identity is available in Convex functions via `ctx.auth.getUserIdentity()`

### 2. Initialize Client in App Entry Point

**File**: `SoraApp.swift`

```swift
import SwiftUI

@main
struct SoraApp: App {
    /// Auth service (manages Auth0 authentication)
    @StateObject private var authService = AuthService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
        }
    }
}
```

### 3. Create Main Content View

**File**: `ContentView.swift`

```swift
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        Group {
            if authService.isLoading {
                LoadingView()
            } else if authService.isAuthenticated {
                AuthenticatedView()
            } else {
                UnauthenticatedView()
            }
        }
        .alert("Error", isPresented: .constant(authService.errorMessage != nil)) {
            Button("OK") {
                authService.errorMessage = nil
            }
        } message: {
            if let error = authService.errorMessage {
                Text(error)
            }
        }
    }
}
```

### 4. Create Authentication Views

**File**: `Views/Auth/UnauthenticatedView.swift`

```swift
import SwiftUI

struct UnauthenticatedView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        VStack(spacing: 24) {
            // App Logo/Icon
            Image(systemName: "book.fill")
                .font(.system(size: 80))
                .foregroundColor(.blue)

            // App Name
            Text("Sora")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Your personal article & book library")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Spacer()
                .frame(height: 60)

            // Login Button
            Button {
                Task {
                    await authService.login()
                }
            } label: {
                HStack {
                    Image(systemName: "person.fill")
                    Text("Continue with Auth0")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .padding(.horizontal, 40)

            Text("Same account as the web app")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
```

**File**: `Views/Auth/AuthenticatedView.swift`

```swift
import SwiftUI

struct AuthenticatedView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        TabView {
            // Books Tab
            BooksListView()
                .tabItem {
                    Label("Books", systemImage: "book")
                }

            // Articles Tab (future)
            Text("Articles Coming Soon")
                .tabItem {
                    Label("Articles", systemImage: "doc.text")
                }

            // Profile Tab
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person")
                }
        }
    }
}
```

**File**: `Views/Shared/ProfileView.swift`

```swift
import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationStack {
            List {
                // User Info Section
                Section {
                    if let user = authService.userProfile {
                        HStack {
                            // Profile Picture
                            if let pictureUrl = user.picture {
                                AsyncImage(url: pictureUrl) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    Circle()
                                        .fill(Color.gray.opacity(0.2))
                                }
                                .frame(width: 60, height: 60)
                                .clipShape(Circle())
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.name ?? "User")
                                    .font(.headline)
                                Text(user.email ?? "")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                // Settings Section (future)
                Section("Settings") {
                    NavigationLink {
                        Text("Preferences")
                    } label: {
                        Label("Preferences", systemImage: "gear")
                    }
                }

                // Logout Section
                Section {
                    Button(role: .destructive) {
                        Task {
                            await authService.logout()
                        }
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }
}
```

**File**: `Views/Shared/LoadingView.swift`

```swift
import SwiftUI

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}
```

---

## Authentication

### 1. Auth0 Authentication Service

**File**: `Core/Auth/AuthService.swift`

```swift
import Foundation
import Auth0

/// Manages authentication with Auth0 and Convex integration
@MainActor
class AuthService: ObservableObject {
    // MARK: - Published Properties
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var userProfile: UserInfo?

    // MARK: - Private Properties
    private let credentialsManager: CredentialsManager

    // MARK: - Initialization
    init() {
        // Initialize credentials manager with Auth0 configuration
        // Reads from Auth0.plist automatically
        self.credentialsManager = CredentialsManager(authentication: Auth0.authentication())

        // Check if user is already authenticated on app launch
        Task {
            await checkAuthentication()
        }
    }

    // MARK: - Public Methods

    /// Log in with Auth0 Universal Login
    func login() async {
        isLoading = true
        errorMessage = nil

        do {
            // Start Auth0 Universal Login flow
            let credentials = try await Auth0
                .webAuth()
                .scope("openid profile email offline_access")
                .audience("https://\(Auth0.plist["Domain"] as! String)/api/v2/")
                .start()

            // Store credentials securely in Keychain
            _ = credentialsManager.store(credentials: credentials)

            // Get user profile
            let userInfo = try await Auth0
                .authentication()
                .userInfo(withAccessToken: credentials.accessToken)

            // Update state
            self.userProfile = userInfo
            self.isAuthenticated = true

            // Set Auth0 token in Convex client
            await ConvexClient.shared.setAuth0Token(credentials.idToken)

        } catch {
            self.errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Log out from Auth0 and clear session
    func logout() async {
        isLoading = true

        do {
            // Clear credentials from Keychain
            _ = credentialsManager.clear()

            // Logout from Auth0 (clears session)
            try await Auth0
                .webAuth()
                .clearSession()

            // Update state
            self.isAuthenticated = false
            self.userProfile = nil

            // Clear Convex auth
            ConvexClient.shared.clearAuth()

        } catch {
            self.errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Check if user is authenticated (on app launch)
    func checkAuthentication() async {
        // Try to get valid credentials from Keychain
        guard let credentials = try? await credentialsManager.credentials() else {
            self.isAuthenticated = false
            return
        }

        do {
            // Get user profile
            let userInfo = try await Auth0
                .authentication()
                .userInfo(withAccessToken: credentials.accessToken)

            // Update state
            self.userProfile = userInfo
            self.isAuthenticated = true

            // Set Auth0 token in Convex client
            await ConvexClient.shared.setAuth0Token(credentials.idToken)

        } catch {
            // Token might be expired or invalid
            self.isAuthenticated = false
            _ = credentialsManager.clear()
        }
    }
}

// MARK: - Auth0.plist Helper
extension Auth0 {
    static var plist: [String: Any] {
        guard let path = Bundle.main.path(forResource: "Auth0", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path) as? [String: Any] else {
            fatalError("Auth0.plist file not found or invalid")
        }
        return dict
    }
}
```

**Key Features:**
- ✅ Uses Auth0 Universal Login (same as web app)
- ✅ Stores credentials securely in iOS Keychain
- ✅ Auto-refreshes expired tokens
- ✅ Integrates with Convex client
- ✅ Checks auth state on app launch

---

## Books Feature Implementation

### 1. Book Model

**File**: `Models/Book.swift`

```swift
import Foundation

/// Book model matching the Convex schema
/// See: convex/schema.ts - books table definition
struct Book: Identifiable, Codable {
    let id: String                  // Convex _id
    let userId: String              // Owner user ID
    let title: String
    let author: String?
    let coverUrl: String?
    let publishedDate: Double?      // Unix timestamp (milliseconds)
    let status: BookStatus
    let tags: [String]
    let favorited: Bool
    let dateStarted: Double?        // Unix timestamp
    let dateRead: Double?           // Unix timestamp
    let addedAt: Double             // Unix timestamp

    /// Computed property for published date as Swift Date
    var publishedDateObj: Date? {
        guard let publishedDate = publishedDate else { return nil }
        return Date(timeIntervalSince1970: publishedDate / 1000)
    }

    /// Computed property for date started as Swift Date
    var dateStartedObj: Date? {
        guard let dateStarted = dateStarted else { return nil }
        return Date(timeIntervalSince1970: dateStarted / 1000)
    }

    /// Computed property for date read as Swift Date
    var dateReadObj: Date? {
        guard let dateRead = dateRead else { return nil }
        return Date(timeIntervalSince1970: dateRead / 1000)
    }

    /// Coding keys to match Convex field names
    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case userId
        case title
        case author
        case coverUrl
        case publishedDate
        case status
        case tags
        case favorited
        case dateStarted
        case dateRead
        case addedAt
    }
}

/// Book reading status
enum BookStatus: String, Codable, CaseIterable {
    case notStarted = "not_started"
    case reading = "reading"
    case finished = "finished"
    case abandoned = "abandoned"

    var displayName: String {
        switch self {
        case .notStarted: return "Not Started"
        case .reading: return "Reading"
        case .finished: return "Finished"
        case .abandoned: return "Abandoned"
        }
    }

    var icon: String {
        switch self {
        case .notStarted: return "book.closed"
        case .reading: return "book"
        case .finished: return "checkmark.circle"
        case .abandoned: return "xmark.circle"
        }
    }
}
```

### 2. Books ViewModel

**File**: `ViewModels/BooksViewModel.swift`

```swift
import Foundation
import Convex
import Combine

/// ViewModel for managing books list and operations
@MainActor
class BooksViewModel: ObservableObject {
    private let client = ConvexClient.shared.client

    @Published var books: [Book] = []
    @Published var isLoading = false
    @Published var error: String?

    // Filters
    @Published var selectedStatus: BookStatus?
    @Published var selectedTag: String?

    /// Convex subscription for real-time updates
    private var subscription: AnyCancellable?

    init() {
        subscribeToBooks()
    }

    /// Subscribe to books query for real-time updates
    func subscribeToBooks() {
        isLoading = true

        // Build query arguments
        var args: [String: Any] = [:]
        if let status = selectedStatus {
            args["status"] = status.rawValue
        }
        if let tag = selectedTag {
            args["tag"] = tag
        }

        // Subscribe to Convex query
        // The exact API depends on Convex Swift SDK
        subscription = client.subscribe(
            query: "books:listBooks",
            args: args
        ) { [weak self] (result: Result<[Book], Error>) in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success(let books):
                    self?.books = books
                    self?.error = nil
                case .failure(let error):
                    self?.error = error.localizedDescription
                    self?.books = []
                }
            }
        }
    }

    /// Add a new book
    func addBook(
        title: String,
        author: String?,
        coverUrl: String?,
        status: BookStatus = .notStarted,
        tags: [String] = []
    ) async throws {
        do {
            _ = try await client.mutation(
                "books:addBook",
                args: [
                    "title": title,
                    "author": author as Any,
                    "coverUrl": coverUrl as Any,
                    "status": status.rawValue,
                    "tags": tags
                ]
            )
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Update book status
    func updateBookStatus(_ bookId: String, status: BookStatus) async throws {
        do {
            _ = try await client.mutation(
                "books:updateBook",
                args: [
                    "bookId": bookId,
                    "status": status.rawValue
                ]
            )
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Toggle favorite status
    func toggleFavorite(_ book: Book) async throws {
        do {
            _ = try await client.mutation(
                "books:updateBook",
                args: [
                    "bookId": book.id,
                    "favorited": !book.favorited
                ]
            )
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Delete a book
    func deleteBook(_ bookId: String) async throws {
        do {
            _ = try await client.mutation(
                "books:deleteBook",
                args: ["bookId": bookId]
            )
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Add tag to book
    func addTag(to bookId: String, tag: String) async throws {
        do {
            _ = try await client.mutation(
                "books:addTag",
                args: [
                    "bookId": bookId,
                    "tag": tag
                ]
            )
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Remove tag from book
    func removeTag(from bookId: String, tag: String) async throws {
        do {
            _ = try await client.mutation(
                "books:removeTag",
                args: [
                    "bookId": bookId,
                    "tag": tag
                ]
            )
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }

    /// Filter by status
    func filterByStatus(_ status: BookStatus?) {
        selectedStatus = status
        subscribeToBooks() // Re-subscribe with new filter
    }

    /// Filter by tag
    func filterByTag(_ tag: String?) {
        selectedTag = tag
        subscribeToBooks() // Re-subscribe with new filter
    }
}
```

### 3. Books List View

**File**: `Views/Books/BooksListView.swift`

```swift
import SwiftUI

struct BooksListView: View {
    @StateObject private var viewModel = BooksViewModel()
    @State private var showingAddBook = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.books.isEmpty {
                    ProgressView("Loading books...")
                } else if viewModel.books.isEmpty {
                    emptyState
                } else {
                    booksList
                }
            }
            .navigationTitle("My Books")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddBook = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }

                ToolbarItem(placement: .navigationBarLeading) {
                    filterMenu
                }
            }
            .sheet(isPresented: $showingAddBook) {
                AddBookView()
            }
            .alert("Error", isPresented: .constant(viewModel.error != nil)) {
                Button("OK") {
                    viewModel.error = nil
                }
            } message: {
                if let error = viewModel.error {
                    Text(error)
                }
            }
        }
    }

    private var booksList: some View {
        List {
            ForEach(viewModel.books) { book in
                NavigationLink {
                    BookDetailView(book: book)
                } label: {
                    BookRowView(book: book)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        Task {
                            try? await viewModel.deleteBook(book.id)
                        }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }

                    Button {
                        Task {
                            try? await viewModel.toggleFavorite(book)
                        }
                    } label: {
                        Label(
                            book.favorited ? "Unfavorite" : "Favorite",
                            systemImage: book.favorited ? "star.fill" : "star"
                        )
                    }
                    .tint(.yellow)
                }
            }
        }
        .refreshable {
            viewModel.subscribeToBooks()
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Books", systemImage: "book.closed")
        } description: {
            Text("Add your first book to get started")
        } actions: {
            Button("Add Book") {
                showingAddBook = true
            }
        }
    }

    private var filterMenu: some View {
        Menu {
            Picker("Status", selection: $viewModel.selectedStatus) {
                Text("All").tag(nil as BookStatus?)
                ForEach(BookStatus.allCases, id: \.self) { status in
                    Text(status.displayName).tag(status as BookStatus?)
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
        }
    }
}
```

### 4. Book Row View

**File**: `Views/Books/BookRowView.swift`

```swift
import SwiftUI

struct BookRowView: View {
    let book: Book

    var body: some View {
        HStack(spacing: 12) {
            // Book cover
            if let coverUrl = book.coverUrl {
                AsyncImage(url: URL(string: coverUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .overlay {
                            Image(systemName: "book.closed")
                                .foregroundColor(.gray)
                        }
                }
                .frame(width: 50, height: 75)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 50, height: 75)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay {
                        Image(systemName: "book.closed")
                            .foregroundColor(.gray)
                    }
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(book.title)
                        .font(.headline)
                        .lineLimit(2)

                    if book.favorited {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundColor(.yellow)
                    }
                }

                if let author = book.author {
                    Text(author)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Label(book.status.displayName, systemImage: book.status.icon)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if !book.tags.isEmpty {
                        Text("• \(book.tags.count) tags")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}
```

### 5. Add Book View

**File**: `Views/Books/AddBookView.swift`

```swift
import SwiftUI

struct AddBookView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = BooksViewModel()

    @State private var title = ""
    @State private var author = ""
    @State private var coverUrl = ""
    @State private var selectedStatus: BookStatus = .notStarted
    @State private var isAdding = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Book Details") {
                    TextField("Title", text: $title)
                    TextField("Author", text: $author)
                    TextField("Cover URL (optional)", text: $coverUrl)
                }

                Section("Status") {
                    Picker("Reading Status", selection: $selectedStatus) {
                        ForEach(BookStatus.allCases, id: \.self) { status in
                            Label(status.displayName, systemImage: status.icon)
                                .tag(status)
                        }
                    }
                }
            }
            .navigationTitle("Add Book")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        addBook()
                    }
                    .disabled(title.isEmpty || isAdding)
                }
            }
            .disabled(isAdding)
        }
    }

    private func addBook() {
        isAdding = true

        Task {
            do {
                try await viewModel.addBook(
                    title: title,
                    author: author.isEmpty ? nil : author,
                    coverUrl: coverUrl.isEmpty ? nil : coverUrl,
                    status: selectedStatus
                )
                dismiss()
            } catch {
                // Error is handled in viewModel
                isAdding = false
            }
        }
    }
}
```

---

## Testing

### 1. Test Authentication Flow

**Using the app:**
1. Build and run the app in the simulator
2. Click "Continue with Auth0"
3. Browser/web view will open with Auth0 Universal Login
4. Sign in with your Auth0 credentials (same as web app)
5. App should redirect back and show the authenticated view

**Troubleshooting:**
- If the browser doesn't redirect back, check your callback URLs in Auth0 Dashboard
- If you see an error, check the Xcode console for detailed logs
- Verify Auth0.plist contains the correct domain and client ID

**Testing with existing web app user:**
Use the same email/password you use on the web app - the iOS app shares the same Auth0 application!

### 2. Test Books Query

```swift
// In your app or preview
let viewModel = BooksViewModel()

// Books will automatically populate via subscription
// Check viewModel.books after a moment
```

### 3. Test Adding a Book

```swift
Task {
    try await viewModel.addBook(
        title: "The Swift Programming Language",
        author: "Apple Inc.",
        coverUrl: nil,
        status: .reading,
        tags: ["Programming", "Swift"]
    )
}
```

---

## Important Implementation Notes

### Auth0 + Convex Integration

**How Auth0 and Convex work together:**

1. **User logs in** → Auth0 Universal Login (web view)
2. **Auth0 returns credentials** → ID token, access token, refresh token
3. **ID token passed to Convex** → `ConvexClient.shared.setAuth0Token(idToken)`
4. **Convex validates token** → Using `convex/auth.config.ts` JWT provider
5. **User identity available** → In Convex functions via `ctx.auth.getUserIdentity()`

**Key points:**
- ✅ The **ID token** is what Convex uses for authentication
- ✅ Token validation happens automatically in Convex
- ✅ Same Auth0 application for both web and iOS
- ✅ Credentials stored securely in iOS Keychain via `CredentialsManager`
- ✅ Tokens auto-refresh when expired

### Convex Swift SDK API

The code examples above assume the Convex Swift SDK follows this pattern:

```swift
// Queries (real-time subscriptions)
client.subscribe(query: "books:listBooks", args: [...]) { result in ... }

// Mutations (write operations)
try await client.mutation("books:addBook", args: [...])

// Actions (external HTTP calls)
try await client.action("books:searchOpenLibrary", args: [...])
```

**Check the actual Convex Swift SDK documentation** for the exact API. You may need to adjust:
- Function call syntax
- Result type handling
- Error handling patterns
- Authentication token management

### Real-time Updates

Convex queries are **reactive** by default. When you subscribe to a query:
1. You receive initial results immediately
2. Results automatically update when data changes in the database
3. No polling or manual refresh needed

This is similar to the web app's `useQuery` hook.

### Auth0 Token Storage

Auth0's `CredentialsManager` automatically handles secure storage:
- ✅ Stores credentials in iOS Keychain
- ✅ Encrypts sensitive data
- ✅ Auto-refreshes expired tokens
- ✅ Supports biometric authentication (Face ID/Touch ID)

**No manual Keychain code needed** - `CredentialsManager` handles everything!

## Common Gotchas & Troubleshooting

### Auth0 Issues

**1. "Invalid callback URL" error**
- **Cause:** Callback URL in Auth0 Dashboard doesn't match app's bundle identifier
- **Fix:** Ensure `YOUR_BUNDLE_IDENTIFIER://YOUR_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback` is in Allowed Callback URLs

**2. "Auth0.plist not found" error**
- **Cause:** File not added to app target
- **Fix:** Select Auth0.plist in Xcode → File Inspector → Check your app under "Target Membership"

**3. Browser doesn't return to app**
- **Cause:** URL scheme not configured or callback URL mismatch
- **Fix:** Verify callback URLs exactly match in both Auth0 Dashboard and Xcode
- **Alternative:** For development, add `.useEphemeralSession()` to bypass (requires re-login each time)

**4. "Domain or ClientId not found" error**
- **Cause:** Auth0.plist has incorrect keys or values
- **Fix:** Ensure keys are `ClientId` and `Domain` (case-sensitive), values match Auth0 Dashboard

**5. Permission alert appears on login**
- **Expected:** This is normal for development with custom URL schemes
- **Fix for production:** Configure Universal Links (requires paid Apple Developer account)

### Convex Issues

**6. "Not authenticated" errors in queries**
- **Cause:** Auth0 token not passed to Convex or token expired
- **Fix:** Check that `setAuth0Token()` is called after successful Auth0 login
- **Debug:** Print the ID token to verify it's not empty

**7. Data not syncing between web and iOS**
- **Cause:** Different Auth0 applications or Convex deployments
- **Fix:** Use the **same Auth0 application** for both web and iOS
- **Verify:** Check `Auth0.plist` domain matches web app's `NEXT_PUBLIC_AUTH0_DOMAIN`

**8. Real-time updates not working**
- **Cause:** Not using subscription API correctly
- **Fix:** Ensure you're using `client.subscribe()` not `client.query()`
- **Verify:** Check Convex Swift SDK documentation for subscription API

### Development Tips

**Use the same Auth0 account:**
- Create one user in the web app
- Use the same credentials in the iOS app
- Data will sync automatically!

**Test on real device:**
- Universal Links only work on physical devices
- Simulator works fine for development with custom URL schemes

**Check Xcode Console:**
- Auth0 SDK logs detailed error messages
- Convex client logs network requests
- Use these to debug issues

---

## Next Steps

### 1. Complete Authentication UI
- Build `SignInView.swift` and `SignUpView.swift`
- Add password validation
- Handle loading states and errors
- Implement "Remember Me" functionality

### 2. Enhance Books Feature
- Implement `BookDetailView.swift` for viewing individual books
- Add search functionality using `searchOpenLibrary` action
- Add tag management UI
- Implement filtering and sorting

### 3. Add Articles Feature
Follow the same pattern as Books:
- Create `Article.swift` model matching `convex/schema.ts`
- Create `ArticlesViewModel.swift`
- Build `ArticlesListView.swift`
- Subscribe to `articles:listArticles` query

### 4. Add User Preferences
- Fetch and display reading preferences
- Sync theme settings between web and iOS
- Implement article reader with customizable typography

### 5. Production Checklist
- [ ] Add proper error handling and retry logic
- [ ] Implement offline support (cache data locally)
- [ ] Add loading skeletons for better UX
- [ ] Implement pull-to-refresh
- [ ] Add haptic feedback
- [ ] Handle authentication expiration
- [ ] Add analytics and crash reporting
- [ ] Write unit tests for ViewModels
- [ ] Write UI tests for critical flows

---

## Resources

### Auth0 Documentation
- **Auth0 iOS Swift Quickstart**: https://auth0.com/docs/quickstart/native/ios-swift
- **Auth0 Swift SDK**: https://github.com/auth0/Auth0.swift
- **Auth0 Dashboard**: https://manage.auth0.com
- **Auth0 Universal Login**: https://auth0.com/docs/authenticate/login/auth0-universal-login

### Convex Documentation
- **Convex Swift SDK**: https://github.com/get-convex/convex-swift
- **Convex Functions (Backend)**: https://docs.convex.dev/functions
- **Convex Auth with Auth0**: https://docs.convex.dev/auth/auth0
- **Convex + Auth0 Integration**: https://github.com/get-convex/convex-swift-auth0

### Backend API Reference

All Convex functions are in the `convex/` folder of the main project:

**Books Functions** (`convex/books.ts`):
- `books:listBooks` (query) - List books with optional filters
- `books:getBook` (query) - Get single book by ID
- `books:addBook` (mutation) - Add new book
- `books:updateBook` (mutation) - Update book metadata
- `books:deleteBook` (mutation) - Delete book
- `books:addTag` (mutation) - Add tag to book
- `books:removeTag` (mutation) - Remove tag from book
- `books:searchOpenLibrary` (action) - Search for books via OpenLibrary API

**Authentication**:
- Uses Auth0 for authentication (same as web app)
- Convex validates Auth0 ID tokens via `convex/auth.config.ts`
- User identity available via `ctx.auth.getUserIdentity()` in Convex functions

### Deployment URL
```
https://hallowed-aardvark-843.convex.cloud
```

---

## Questions or Issues?

If you encounter any issues:

1. **Check Convex Swift SDK docs** for the latest API changes
2. **Test Convex functions directly** in the web app to verify backend behavior
3. **Use Convex dashboard** to inspect database state and function logs
4. **Verify authentication tokens** are being passed correctly

The iOS app should behave identically to the web app since they share the same backend logic. When in doubt, reference the web app implementation in `src/app/dashboard/`.

Good luck building Sora for iOS!
