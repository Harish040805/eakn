let tasks = [];
let editingTaskId = null;
let db;
const addBtn = document.getElementById('add-btn');
const tasksDiv = document.getElementById('tasks');
const request = indexedDB.open('TaskDB', 1);
request.onupgradeneeded = function(event) {
    db = event.target.result;
    if(!db.objectStoreNames.contains('tasks')){
        const store = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: true });
        store.createIndex('priority', 'priority', { unique: false });
    }
};
request.onsuccess = function(event) { db = event.target.result; loadTasks(); };
request.onerror = function(event) { console.error("IndexedDB error:", event.target.errorCode); };
function saveTaskToDB(task, callback){ 
    const tx = db.transaction('tasks', 'readwrite'); 
    const store = tx.objectStore('tasks');
    const request = task.id ? store.put(task) : store.add(task);
    request.onsuccess = () => callback();
}
function deleteTaskFromDB(id, callback){
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    store.delete(id).onsuccess = () => callback();
}
function loadTasks(){
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    store.getAll().onsuccess = (e) => {
        tasks = e.target.result;
        tasks.sort((a, b) => {
            if ((a.priority || 0) === 0 && (b.priority || 0) === 0) { return new Date(a.start) - new Date(b.start); }
            if ((a.priority || 0) === 0) return 1;
            if ((b.priority || 0) === 0) return -1;
            return (a.priority || 0) - (b.priority || 0);
        });
        tasks.sort((a, b) => new Date(a.start) - new Date(b.start));
        displayTasks();
    };
}
addBtn.addEventListener('click', addTask);
function addTask(){
    const name = document.getElementById('task-name').value.trim();
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    if(!name || !start || !end){ alert("Please provide Task Name, Start Date & Time, and End Date & Time."); return; }
    const duplicate = tasks.some(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== editingTaskId);
    if(duplicate){ alert("Task name already exists!"); return; }
let dailyRepeatValue = 0;
if (editingTaskId !== null) { const existingTask = tasks.find(t => t.id === editingTaskId); dailyRepeatValue = existingTask ? existingTask.dailyRepeat : 0; }
    const task = editingTaskId !== null ? { id: editingTaskId, name, start, end, priority: 0, dailyRepeat: task.dailyRepeat || 0 } : { name, start, end, priority: 0, dailyRepeat: 0 };
    saveTaskToDB(task, () => { editingTaskId = null; addBtn.textContent = 'Add'; clearInputs(); loadTasks(); });
}
function displayTasks(){
    tasksDiv.innerHTML = '';
    tasks.forEach(task => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task';
        const nameSpan = document.createElement('span');
        nameSpan.contentEditable = true;
        nameSpan.textContent = task.name;
        nameSpan.style.borderBottom = '1px dashed #fff';
        nameSpan.addEventListener('blur', () => {
            const newName = nameSpan.textContent.trim();
            if(newName && newName !== task.name){ task.name = newName; saveTaskToDB(task, loadTasks); } 
            else { nameSpan.textContent = task.name; }
        });
        taskDiv.appendChild(nameSpan);
        const startSpan = document.createElement('span');
        startSpan.textContent = formatDateTime(task.start);
        taskDiv.appendChild(startSpan);
        const endSpan = document.createElement('span');
        endSpan.textContent = formatDateTime(task.end);
        taskDiv.appendChild(endSpan);
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.dataset.id = task.id;
        progressContainer.appendChild(progressBar);
        taskDiv.appendChild(progressContainer);
        const priorityInput = document.createElement('input');
        priorityInput.type = 'number';
        priorityInput.min = 0;
        priorityInput.value = task.priority || 0;
        priorityInput.style.width = '50px';
        priorityInput.addEventListener('change', () => {
            task.priority = parseInt(priorityInput.value) || 0;
            saveTaskToDB(task, loadTasks);
        });
        taskDiv.appendChild(priorityInput);
function createHHMMInput(initialValue = "00:00") {
    const input = document.createElement('input');
    input.type = 'text'; 
    input.placeholder = 'hh:mm';
    input.value = initialValue;
    input.style.width = '80px';
    input.maxLength = 5; 
    input.addEventListener('input', (e) => {
        let val = input.value.replace(/[^0-9]/g, ''); 
        if(val.length > 4) val = val.slice(0,4);
        if(val.length > 2) { val = val.slice(0,2) + ':' + val.slice(2); }
        input.value = val;
    });
    input.addEventListener('blur', () => {
        let [hh, mm] = input.value.split(':').map(Number);
        hh = isNaN(hh) ? 0 : Math.min(hh, 99); 
        mm = isNaN(mm) ? 0 : Math.min(mm, 59);
        input.value = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    });
    return input;
}
const weightInput = createHHMMInput(task.weight || "00:00");
weightInput.addEventListener('change', () => { task.weight = weightInput.value;  saveTaskToDB(task, loadTasks); });
taskDiv.appendChild(weightInput);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', () => editTask(task.id));
        taskDiv.appendChild(editBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => deleteTaskFromDB(task.id, loadTasks));
        taskDiv.appendChild(deleteBtn);
        tasksDiv.appendChild(taskDiv);
        const dailyBtn = document.createElement("button");
dailyBtn.className = "daily-repeat-btn";
if (task.dailyRepeat === 1) { dailyBtn.style.background = "#ff0000"; dailyBtn.textContent = "Daily Repeat: ON (Dont use, under const)"; } 
else { dailyBtn.style.background = "#ff7171"; dailyBtn.textContent = "Daily Repeat: OFF (Dont use, under const)"; }
dailyBtn.addEventListener("click", () => {
    task.dailyRepeat = task.dailyRepeat === 1 ? 0 : 1;
    if (task.dailyRepeat === 1) { dailyBtn.style.background = "#ff0000"; dailyBtn.textContent = "Daily Repeat: ON (Dont use, under const)"; } 
    else { dailyBtn.style.background = "#ff7171"; dailyBtn.textContent = "Daily Repeat: OFF (Dont use, under const)"; }
    saveTaskToDB(task, loadTasks);
});
taskDiv.appendChild(dailyBtn);
    });
	computeIntentAlignment();
}
function weightToMinutes(weight){ if(!weight) return Infinity; const [h,m] = weight.split(':').map(Number); return h*60 + m; }
function loadTasks(){
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    store.getAll().onsuccess = (e) => {
        tasks = e.target.result;
        tasks.sort((a, b) => {
            const pA = a.priority || 0;
            const pB = b.priority || 0;
            if(pA !== pB) return pA - pB;
            const tA = new Date(a.start);
            const tB = new Date(b.start);
            if(tA - tB !== 0) return tA - tB;
            const wA = weightToMinutes(a.weight);
            const wB = weightToMinutes(b.weight);
            return wA - wB;
        });
        displayTasks();
    };
}
function editTask(id){
    const task = tasks.find(t => t.id === id);
    if(task){
        alert("Please check the panel in the left side");
        editingTaskId = id;
        document.getElementById('task-name').value = task.name;
        document.getElementById('start-date').value = task.start;
        document.getElementById('end-date').value = task.end;
        addBtn.textContent = 'Save';
    }
}
function clearInputs(){ document.getElementById('task-name').value = ''; document.getElementById('start-date').value = ''; document.getElementById('end-date').value = ''; }
function updateProgressBars() {
    const bars = document.querySelectorAll('.progress-bar');
    const taskDivs = document.querySelectorAll('.task');
    tasks.forEach((task, i) => {
        const start = new Date(task.start);
        const end = new Date(task.end);
        const now = new Date();
        const totalTime = end - start;
        const elapsed = now - start;
        let progress = 0;
        if (now < start) progress = 0;
        else if (now > end) progress = 1;
        else progress = elapsed / totalTime;
        const bar = bars[i];
        bar.style.width = `${progress * 100}%`;
        if (progress < 0.2) bar.style.backgroundColor = 'lightgreen';
        else if (progress < 0.4) bar.style.backgroundColor = 'lime';
        else if (progress < 0.6) bar.style.backgroundColor = 'yellow';
        else if (progress < 0.8) bar.style.backgroundColor = 'orange';
        else bar.style.backgroundColor = 'red';
        if (now > end) { taskDivs[i].style.backgroundColor = '#800000a4'; startBeep();  } 
        else { taskDivs[i].style.backgroundColor = '#0ea124a4'; }
    });
}
setInterval(updateProgressBars, 1000);
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2,'0');
    const minutes = String(now.getMinutes()).padStart(2,'0');
    const seconds = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('time-24').textContent = `${hours}:${minutes}:${seconds}`;
    const day = String(now.getDate()).padStart(2,'0');
    const month = String(now.getMonth()+1).padStart(2,'0');
    const year = now.getFullYear();
    document.getElementById('date-ddmmyyyy').textContent = `${day}/${month}/${year}`;
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[now.getMonth()];
    document.getElementById('date-month-dd-yyyy').textContent = `${monthName}, ${day}, ${year}`;
}
setInterval(updateClock, 1000);
updateClock();
function formatDateTime(datetime) {
    const d = new Date(datetime);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year}_${hours}:${minutes}:${seconds}`;
}
const meter = document.getElementById('independent-meter');
function updateMeter() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const secondsPassed = hours * 3600 + minutes * 60 + seconds;
    const totalSeconds = 24 * 3600;
    const percent = (secondsPassed / totalSeconds) * 100;
    meter.style.width = percent + '%';
if ((hours >= 22 && hours <= 23) || (hours >= 0 && hours < 5)) { meter.style.backgroundColor = '#FFFFFF'; } 
else if (hours >= 5 && hours < 6) { meter.style.backgroundColor = '#FF6200'; } 
else if (hours >= 6 && hours < 8) { meter.style.backgroundColor = '#84d6ffff'; } 
else if (hours >= 8 && hours < 12) { meter.style.backgroundColor = '#DBFFFF'; } 
else if (hours >= 12 && hours < 15) { meter.style.backgroundColor = '#FFFF00'; } 
else if (hours >= 15 && hours < 16) { meter.style.backgroundColor = '#a4e8d4ff'; } 
else if (hours >= 16 && hours < 17) { meter.style.backgroundColor = '#73FF00'; } 
else if (hours >= 17 && hours < 18) { meter.style.backgroundColor = '#AFBDE3'; } 
else if (hours >= 18 && hours < 19) { meter.style.backgroundColor = '#71A871'; } 
else if (hours >= 19 && hours < 22) { meter.style.backgroundColor = '#00008B'; }
    setTimeout(updateMeter, 1000);
}
updateMeter();
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let ioOn = true;
let activeMode = null;
let beepInterval = null;
const ioBtn = document.getElementById('btn-io');
const aBtn = document.getElementById('btn-a');
const bBtn = document.getElementById('btn-b');
function playBeep(duration = 300, freq = 440) {
  if (!ioOn) return;
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration / 1000);
}
function startBeep(intervalMs = 1000, duration = 300, freq = 440) { if (beepInterval) return; beepInterval = setInterval(() => playBeep(duration, freq), intervalMs); }
function stopBeep() { clearInterval(beepInterval); beepInterval = null; }
ioBtn.addEventListener('click', () => {
  ioOn = false;  
  stopBeep();
  activeMode = null;
  aBtn.classList.remove('active');
  bBtn.classList.remove('active');
  ioBtn.textContent = "On/Off (OFF)";
  ioBtn.style.backgroundColor = "#00ca00";
});
function hasTasksInProgress() {
  const now = new Date();
  return tasks.some(t => { const start = new Date(t.start); const end = new Date(t.end); return now >= start && now < end; });
}
function hasTasksRunningOut() {
  const now = new Date();
  return tasks.some(t => {
    const start = new Date(t.start);
    const end = new Date(t.end);
    const total = end - start;
    const remaining = end - now;
    if (remaining <= 0) return false;
    const percentRemaining = remaining / total;
    return percentRemaining <= 0.1; 
  });
}
setInterval(() => {
  if (!ioOn) return;
  if (activeMode === 'A') {
    if (hasTasksInProgress()) { if (!beepInterval) startBeep(1000, 300, 440); } 
    else { stopBeep(); }
  }
  if (activeMode === 'B') {
    if (hasTasksRunningOut()) { if (!beepInterval) startBeep(800, 200, 880); } 
    else { stopBeep(); }
  }
}, 1000);
aBtn.addEventListener('click', () => {
  if (!ioOn) { ioOn = true; ioBtn.textContent = "On/Off (ON)"; ioBtn.style.backgroundColor = ""; }
  if (activeMode === 'A') { stopBeep(); activeMode = null; aBtn.classList.remove('active'); return; }
  activeMode = 'A';
  aBtn.classList.add('active');
  bBtn.classList.remove('active');
  stopBeep();
});
bBtn.addEventListener('click', () => {
  if (!ioOn) { ioOn = true;  ioBtn.textContent = "IO (ON)"; ioBtn.style.backgroundColor = ""; }
  if (activeMode === 'B') { stopBeep(); activeMode = null; bBtn.classList.remove('active'); return; }
  activeMode = 'B';
  bBtn.classList.add('active');
  aBtn.classList.remove('active');
  stopBeep();
});
document.querySelector('.searcha').addEventListener('click', () => {
    const query = document.querySelector('.searcho').value.trim().toLowerCase();
    const allTasks = document.querySelectorAll('.task span:first-child'); // first span = name
    allTasks.forEach(span => { span.style.outline = 'none'; span.style.backgroundColor = 'transparent'; span.classList.remove('scroll-done'); });
    if (!query) { return; }
    let found = false;
    allTasks.forEach((span, index) => {
        const taskName = span.textContent.trim().toLowerCase();
        if (taskName.includes(query)) {
            found = true;
            span.style.backgroundColor = '#ffea00'; 
            span.style.outline = '2px solid #ffd700';
            if (!document.querySelector('.scroll-done')) { span.scrollIntoView({ behavior: 'smooth', block: 'center' }); span.classList.add('scroll-done'); }
        }
    });
    if (!found) alert('No task found with that name.');
});
function createDailyRepeatButton(task) {
    const btn = document.createElement("button");
    btn.className = "daily-repeat-btn";
    if (task.dailyRepeat === 1) { btn.style.background = "#ff0000"; btn.textContent = "Daily Repeat: ON"; } 
    else { btn.style.background = "#ff7171"; btn.textContent = "Daily Repeat: OFF"; }
    btn.addEventListener("click", () => {
        task.dailyRepeat = task.dailyRepeat === 1 ? 0 : 1;
        if (task.dailyRepeat === 1) { btn.style.background = "#ff0000"; btn.textContent = "Daily Repeat: ON"; } 
        else { btn.style.background = "#ff7171"; btn.textContent = "Daily Repeat: OFF"; }
        updateTaskInDB(task);
    });
    return btn;
}
setInterval(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    tasks.forEach(task => {
        if (task.dailyRepeat !== 1) return;
        const endDate = new Date(task.end);
        const endStr = endDate.toISOString().split("T")[0];
        if (endStr < todayStr) { 
            const start = new Date(task.start); 
            const end = new Date(task.end); 
            start.setDate(start.getDate() + 1); 
            end.setDate(end.getDate() + 1); 
            task.start = start.toISOString(); 
            task.end = end.toISOString(); 
            saveTaskToDB(task, () => {}); 
        }
    });
}, 60000);