import os
import time
import cv2
import threading
import numpy as np
import pandas as pd
from collections import deque, Counter
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
from pymongo import MongoClient
from bson.objectid import ObjectId
from deepface import DeepFace

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

client_db = MongoClient(os.environ.get("MONGO_URI"))
db = client_db["EAKN_Project"]
tasks_collection = db["tasks"]
users_collection = db["users"]

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

app = Flask(__name__)
CORS(app)

cap = None
current_emotion = "Analyzing..."
latest_frame = None 
emotion_records = []
running = False

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def map_emotion(emotion_dict):
    """Refined mapping for EAKN project emotions."""
    if not emotion_dict: return "Neutral", 0
    base = max(emotion_dict, key=emotion_dict.get).lower()
    score = emotion_dict.get(base, 0)

    mapping = {
        "happy": ("Love" if score > 95 else "Happy"),
        "neutral": ("Peace" if score > 90 else "Neutral"),
        "angry": ("Valour" if score > 92 else "Angry"),
        "surprise": "Wonder",
        "disgust": "Disgust",
        "fear": "Fear",
        "sad": ("Shy" if score < 40 else "Sad")
    }
    result = mapping.get(base, "Neutral")
    return (result[0], score) if isinstance(result, tuple) else (result, score)

def emotion_worker():
    """Processes the LATEST frame captured by the video feed thread."""
    global current_emotion, running, latest_frame, emotion_records

    while True:
        if running and latest_frame is not None:
            try:
                frame_to_process = latest_frame.copy()
                
                results = DeepFace.analyze(
                    frame_to_process, 
                    actions=['emotion'], 
                    enforce_detection=False, 
                    detector_backend='opencv', 
                    silent=True
                )

                if results and len(results) > 0:
                    raw_emotions = results[0]['emotion']
                    refined, confidence = map_emotion(raw_emotions)
                    
                    current_emotion = refined
                    
                    emotion_records.append([time.strftime("%H:%M:%S"), refined, round(confidence, 2)])
                else:
                    print("AI Warning: No face detected in frame.")

            except Exception as e:
                print(f"Detection Loop Error: {e}")

        time.sleep(0.5)

threading.Thread(target=emotion_worker, daemon=True).start()

@app.route('/video_feed')
def video_feed():
    global cap, running, latest_frame
    if cap is None or not cap.isOpened():
        cap = cv2.VideoCapture(0)
    running = True

    def gen():
        global latest_frame
        while running and cap:
            success, frame = cap.read()
            if not success:
                break
            
            latest_frame = frame 

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            for (x, y, w, h) in faces:
                cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                cv2.putText(frame, current_emotion, (x, y-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

            _, buffer = cv2.imencode('.jpg', frame)
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/get_emotion')
def get_emotion():
    global last_heartbeat
    last_heartbeat = time.time()
    return jsonify({"emotion": current_emotion})

def generate_frames():
    global cap, current_emotion, running
    while running:
        if cap is None or not cap.isOpened():
            break
            
        success, frame = cap.read()
        if not success:
            break
        
        if int(time.time() * 10) % 30 == 0:
            try:
                results = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False, silent=True)
                if results:
                    raw_emotion = results[0]['dominant_emotion']
                    current_emotion = map_emotion(raw_emotion)
            except Exception as e:
                print(f"Detection error: {e}")

        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/get_tasks', methods=['GET'])
def get_tasks():
    tasks = list(tasks_collection.find())
    for t in tasks:
        t['id'] = str(t['_id'])
        del t['_id']
    return jsonify(tasks)

@app.route('/add_task', methods=['POST'])
def add_task():
    data = request.json
    res = tasks_collection.insert_one(data)
    return jsonify({"id": str(res.inserted_id), "status": "success"})

@app.route('/delete_task/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        from bson.objectid import ObjectId
        result = tasks_collection.delete_one({"_id": ObjectId(task_id)})
        
        if result.deleted_count > 0:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Task not found"}), 404
    except Exception as e:
        print(f"Delete Error: {e}")
        return jsonify({"status": "error"}), 500

@app.route('/update_task/<task_id>', methods=['PUT'])
def update_task_dynamic(task_id):
    try:
        from bson.objectid import ObjectId
        data = request.json
        
        result = tasks_collection.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {
                "title": data.get('title'),
                "start": data.get('start'),
                "end": data.get('end')
            }}
        )
        
        if result.matched_count > 0:
            return jsonify({"status": "success", "message": "Task updated in MongoDB"})
        else:
            return jsonify({"status": "error", "message": "Task not found"}), 404
            
    except Exception as e:
        print(f"Dynamic Update Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
        
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_msg = data.get('message')
    emotion = current_emotion

    try:
        raw_tasks = list(tasks_collection.find())
        task_context = "\n".join([t.get('title', '') for t in raw_tasks]) if raw_tasks else "No tasks"

        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": f"User emotion: {emotion}\nTasks:\n{task_context}"
                },
                {"role": "user", "content": user_msg}
            ]
        )

        return jsonify({"reply": completion.choices[0].message.content})

    except Exception as e:
        print(e)
        return jsonify({"reply": "Error"}), 500

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    if users_collection.find_one({"email": data.get('email')}):
        return jsonify({"status": "error"})
    users_collection.insert_one(data)
    return jsonify({"status": "success"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = users_collection.find_one({
        "email": data.get('email'),
        "password": data.get('password')
    })
    if user:
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 401

@app.route('/shutdown', methods=['POST'])
def shutdown():
    global running, cap
    running = False
    if cap:
        cap.release()
    os._exit(0)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=False)