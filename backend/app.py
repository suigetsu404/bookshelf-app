import sqlite3
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import os
import bcrypt
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, UserMixin
import requests
import urllib.parse
import logging
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

FLASK_TOKEN = os.getenv("FLASK_SECRET_KEY")
if not FLASK_TOKEN:
    logging.error("FLASK_SECRET_KEY not found in environment variables.")
    raise ValueError("No FLASK_SECRET_KEY set for Flask application. Set it in the .env file.")
GOOGLE_BOOKS_API_KEY = os.getenv("GOOGLE_BOOKS_API_KEY")
if not GOOGLE_BOOKS_API_KEY:
    logging.error("GOOGLE_BOOKS_API_KEY not found in environment variables.")
    raise ValueError("No GOOGLE_BOOKS_API_KEY set for application. Set it in the .env file.")

def db_creation():
    connection = sqlite3.connect(r"C:\Users\admin\Desktop\VSCProjects\BookshelfApp\backend\data\app.db")
    cursor = connection.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users
                        (id INTEGER PRIMARY KEY AUTOINCREMENT,
                         username TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS books
                        (id INTEGER PRIMARY KEY AUTOINCREMENT,
                         title TEXT NOT NULL,
                         author TEXT NOT NULL,
                         status TEXT NOT NULL,
                         rating INTEGER,
                         review TEXT,
                         cover_image_url TEXT,
                         user_id INTEGER NOT NULL,
                         FOREIGN KEY(user_id) REFERENCES users(id))''')
    connection.commit()
    connection.close()
    print("Successfully connected to app.db.")

def get_db_connection():
    connection = sqlite3.connect(r"C:\Users\admin\Desktop\VSCProjects\BookshelfApp\backend\data\app.db")
    connection.row_factory = sqlite3.Row
    return connection

def fetch_book_data_from_google_books(title, author):
    query = f'intitle:{title}+inauthor:{author}'
    url = f'https://www.googleapis.com/books/v1/volumes?q={urllib.parse.quote(query)}&maxResults=1&key={GOOGLE_BOOKS_API_KEY}'
    try:
        response = requests.get(url)
        response.raise_for_status()
        if response.status_code == 200:
            data = response.json()
            if 'items' in data and len(data['items']) > 0:
                book_info = data['items'][0]['volumeInfo']
                cover_image_url = book_info.get('imageLinks', {}).get('thumbnail', '')
                return cover_image_url
        return ''
    except requests.exceptions.RequestException as e:
        logging.error(f"Request error: {e}")
    except Exception as e:
        logging.error(f"Error fetching data from Google Books API: {e}")
        return ''
    return ''

app = Flask(__name__)
app.config['SECRET_KEY'] = FLASK_TOKEN
CORS(app, supports_credentials=True)

login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, id, username, password_hash):
        self.id = id
        self.username = username
        self.password_hash = password_hash
    
    @staticmethod
    def get_by_id(user_id):
        connection = get_db_connection()
        user = connection.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        connection.close()
        if user:
            return User(user['id'], user['username'], user['password_hash'])
        return None
    @staticmethod
    def get_by_username(username):
        connection = get_db_connection()
        user = connection.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        connection.close()
        if user:
            return User(user['id'], user['username'], user['password_hash'])
        return None
    
@login_manager.user_loader
def load_user(user_id):
    return User.get_by_id(int(user_id))

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or request.form or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'message': 'Username and password are required.'}), 400
    if User.get_by_username(username):
        return jsonify({'message': 'Username already exists.'}), 400
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, password_hash))
    connection.commit()
    connection.close()
    return jsonify({'message': 'User registered successfully.'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or request.form or {}
    username = data.get('username')
    password = data.get('password')
    user = User.get_by_username(username)
    if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash):
        login_user(user)
        return jsonify({'message': 'Logged in successfully.'}), 200
    return jsonify({'message': 'Invalid username or password.'}), 401

@login_required
@app.route('/api/books', methods=['GET'])
def get_books():
    connection = get_db_connection()
    books = connection.execute('SELECT * FROM books WHERE user_id = ?', (current_user.id,)).fetchall()
    connection.close()
    books_list = [dict(book) for book in books]
    return jsonify(books_list), 200
@login_required
@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.get_json()
    title = data.get('title')
    author = data.get('author')
    status = data.get('status')
    rating = data.get('rating')
    review = data.get('review')
    if not title or not author or not status:
        return jsonify({'message': 'Title, author, and status are required.'}), 400
    cover_image_url = fetch_book_data_from_google_books(title, author)
    connection = get_db_connection()
    cursor = connection.cursor()
    book = connection.execute('SELECT * FROM books WHERE title = ? AND author = ? AND user_id = ?', (title, author, current_user.id)).fetchone()
    if book:
        connection.close()
        return jsonify({'message': 'Book already exists in your collection.'}), 400
    cursor.execute('''INSERT INTO books (title, author, status, rating, review, cover_image_url, user_id)
                      VALUES (?, ?, ?, ?, ?, ?, ?)''',
                   (title, author, status, rating, review, cover_image_url, current_user.id))
    connection.commit()
    connection.close()
    return jsonify({'message': 'Book added successfully.'}), 201
@login_required
@app.route('/api/books/<id>', methods=['PUT'])
def update_book(id):
    data = request.get_json()
    title = data.get('title')
    author = data.get('author')
    status = data.get('status')
    rating = data.get('rating')
    review = data.get('review')
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('SELECT * FROM books WHERE id = ? AND user_id = ?', (id, current_user.id))
    book = cursor.fetchone()
    if not book:
        connection.close()
        return jsonify({'message': 'Book not found.'}), 404
    cursor.execute('''UPDATE books
                      SET title = ?, author = ?, status = ?, rating = ?, review = ?
                      WHERE id = ? AND user_id = ?''',
                   (title, author, status, rating, review, id, current_user.id))
    connection.commit()
    connection.close()
    return jsonify({'message': 'Book updated successfully.'}), 200
@login_required
@app.route('/api/books/<id>', methods=['DELETE'])
def delete_book(id):
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('SELECT * FROM books WHERE id = ? AND user_id = ?', (id, current_user.id))
    book = cursor.fetchone()
    if not book:
        connection.close()
        return jsonify({'message': 'Book not found.'}), 404
    cursor.execute('DELETE FROM books WHERE id = ? AND user_id = ?', (id, current_user.id))
    connection.commit()
    connection.close()
    return jsonify({'message': 'Book deleted successfully.'}), 200
@login_required
@app.route('/api/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully.'}), 200

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute('''SELECT users.username, COUNT(books.id) AS books_read
                      FROM users
                      LEFT JOIN books ON users.id = books.user_id AND books.status = 'Read'
                      GROUP BY users.id
                      ORDER BY books_read DESC
                      LIMIT 10''')
    leaderboard_data = cursor.fetchall()
    connection.close()
    result = [{'username': row['username'], 'books_read': row['books_read']} for row in leaderboard_data]
    return jsonify(result), 200

@app.route('/api/check_session', methods=['GET'])
def session_status():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "username": current_user.username}), 200
    else:
        return jsonify({"logged_in": False}), 401

if __name__ == '__main__':
    db_creation()
    app.run(debug=True)