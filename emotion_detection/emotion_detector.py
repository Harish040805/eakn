from rmn import RMN
import cv2
import mss
import numpy
import win32gui
import win32con

m = RMN()

with mss.mss() as sct:
    monitor = {"top": 45, "left": 0, "width": 1000, "height": 1000}
    
    while True:
        img = numpy.array(sct.grab(monitor))
        
        if img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        
        results = m.detect_emotion_for_single_frame(img)
        
        img = m.draw(img, results)
        
        cv2.putText(img, "Press 'q' to close window", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.imshow("Emotion Detection", img)
        
        cv2.namedWindow("Emotion Detection", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Emotion Detection", 1000, 960)

        hwnd = win32gui.FindWindow(None, "Emotion Detection")
        win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0,
                              win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)

        if cv2.waitKey(25) & 0xFF == ord("q"):
            cv2.destroyAllWindows()
            break