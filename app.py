from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, logout_user, login_required, UserMixin, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import requests
import os

app = Flask(__name__)
app.secret_key = 'supersecretkey'  # promijeni u produkciji

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'users.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'index'

### 📦 MODELI

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True)
    password = db.Column(db.String(150))

class Household(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))

class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    household = db.Column(db.String(100))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    prediction = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    voltage = db.Column(db.Float)
    reactive_power = db.Column(db.Float)
    intensity = db.Column(db.Float)
    sub_1 = db.Column(db.Float)
    sub_2 = db.Column(db.Float)
    sub_3 = db.Column(db.Float)

### 🔐 AUTENTIKACIJA

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html', user=current_user)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        flash('Netočan username ili password')
        return redirect(url_for('index'))
    login_user(user)
    return redirect(url_for('dashboard'))

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    password = request.form.get('password')
    confirm_password = request.form.get('confirm_password')

    if password != confirm_password:
        flash('Lozinke se ne podudaraju')
        return redirect(url_for('index'))

    if User.query.filter_by(username=username).first():
        flash('Korisničko ime već postoji')
        return redirect(url_for('index'))

    new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
    db.session.add(new_user)
    db.session.commit()

    flash('Registracija uspješna! Prijavite se.')
    return redirect(url_for('index'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', username=current_user.username)

### ✅ KUĆANSTVA I PREDIKCIJE (API-jevi za dashboard.js)

@app.route('/add_household', methods=['POST'])
@login_required
def add_household():
    data = request.get_json()
    name = data.get('name')
    if name:
        exists = Household.query.filter_by(name=name, user_id=current_user.id).first()
        if not exists:
            new_h = Household(name=name, user_id=current_user.id)
            db.session.add(new_h)
            db.session.commit()
    return jsonify({'status': 'ok'})

@app.route('/get_households')
@login_required
def get_households():
    households = Household.query.filter_by(user_id=current_user.id).all()
    return jsonify([h.name for h in households])

@app.route('/predict', methods=['POST'])
@login_required
def predict():
    try:
        data = request.get_json()

        now = datetime.now()
        hour = now.hour
        day = now.day
        month = now.month
        year = now.year
        weekday = now.weekday()
        is_weekend = 1 if weekday in [5, 6] else 0

        features = [
            float(data['Global_reactive_power']),
            float(data['Voltage']),
            float(data['Global_intensity']),
            float(data['Sub_metering_1']),
            float(data['Sub_metering_2']),
            float(data['Sub_metering_3']),
            hour, day, month, year, weekday, is_weekend
        ]

        # pozivanje vanjskog API-ja
        api_response = requests.post("https://energy-api-obaz.onrender.com/predict", json={"data": [features]})
        api_response.raise_for_status()

        prediction_value = float(api_response.json()['prediction'][0])

        new_pred = Prediction(
            household=data['householdSelect'],
            prediction=prediction_value,
            user_id=current_user.id,
            reactive_power=features[0],
            voltage=features[1],
            intensity=features[2],
            sub_1=features[3],
            sub_2=features[4],
            sub_3=features[5]
        )
        db.session.add(new_pred)
        db.session.commit()

        return jsonify({'prediction': prediction_value})
    except Exception as e:
        return jsonify({'error': 'Greška pri predikciji', 'details': str(e)}), 500

@app.route('/get_predictions')
@login_required
def get_predictions():
    preds = Prediction.query.filter_by(user_id=current_user.id).order_by(Prediction.timestamp).all()
    result = [{
        'household': p.household,
        'timestamp': p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        'prediction': p.prediction,
        'Voltage': p.voltage,
        'Global_reactive_power': p.reactive_power,
        'Global_intensity': p.intensity,
        'Sub_metering_1': p.sub_1,
        'Sub_metering_2': p.sub_2,
        'Sub_metering_3': p.sub_3
    } for p in preds]
    return jsonify(result)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    port = int(os.environ.get('PORT', 5000))       
    app.run(host='0.0.0.0', port=port, debug=True)  
