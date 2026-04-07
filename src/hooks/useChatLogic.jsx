import { useState, useEffect, useRef } from "react";
import WebRTCService from "../services/WebRTCService";

const NO_ANSWER_TIMEOUT_DURATION = 15000; // 15 seconds

const mapErrorMessageToUserFriendly = (technicalError) => {
  if (!technicalError) return "An unknown error occurred. Please try again.";

  // General connection issues
  if (technicalError.includes("service is not ready") || technicalError.includes("peer is disconnected")) {
    return "Cannot proceed: The connection service isn\'t ready. Please check your connection and try again.";
  }
  if (technicalError.includes("Target peer ID is missing")) {
    return "Cannot start call: The ID of the person you want to call is missing.";
  }
  if (technicalError.includes("Failed to initiate call with PeerJS") || technicalError.includes("Failed to create call object")) {
    return "Could not initiate the call. Please try again shortly.";
  }
  if (technicalError.includes("peer-unavailable") || (technicalError.includes("Peer") && technicalError.includes("is unavailable"))) {
    return "Could not reach the other person. They might be busy, disconnected, or ask them to connect to you instead.";
  }
  if (technicalError.includes("connection-error") || technicalError.includes("Connection error")) {
    return "Call failed. Please check your internet connection.";
  }
  if (technicalError.includes("network") && technicalError.includes("error")) { // Be more specific for network errors
    return "Call failed due to a network problem. Please try again.";
  }
  if (technicalError.includes("WebRTC error") || technicalError.includes("webrtc")) {
    return "A technical problem occurred with the call. Please try again.";
  }
  // Microphone issues
  if (technicalError.includes("No microphone found") || technicalError.includes("NotFoundError") || technicalError.includes("DevicesNotFoundError")) {
    return "Cannot start call: No microphone found, or microphone access was denied. Please check your microphone settings and permissions.";
  }
  if (technicalError.includes("Microphone permission was denied") || technicalError.includes("NotAllowedError") || technicalError.includes("PermissionDeniedError")) {
    return "Cannot start call: Microphone access was denied. Please allow microphone access in your browser settings and try again.";
  }
  // Peer object issues
  if (technicalError.includes("Peer object became null") || technicalError.includes("peer object became invalid")) {
    return "Call failed unexpectedly due to an internal error. Please try reconnecting.";
  }
  if (technicalError.includes("Cannot call self") || technicalError.includes("call with yourself")) {
    return "You cannot start a call with your own ID.";
  }

  // File errors
  if (technicalError.startsWith("File size exceeds")) { // Already user-friendly
    return technicalError;
  }
  if (technicalError.includes("No open connection")) {
      return "Connection lost. Please reconnect to perform this action.";
  }
   if (technicalError.includes("Cannot send empty file")) {
    return "Cannot send an empty file. Please select a file with content.";
  }

  // Screen sharing errors
  if (technicalError.includes("Screen sharing permission was denied")) {
    return "Screen sharing permission was denied. Please allow screen sharing and try again.";
  }
  if (technicalError.includes("No screen sources found")) {
    return "No screen sources found. Please ensure you have windows or screens available to share.";
  }
  if (technicalError.includes("Screen sharing is not supported")) {
    return "Screen sharing is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.";
  }
  if (technicalError.includes("Screen sharing was cancelled")) {
    return "Screen sharing was cancelled by the user.";
  }
  if (technicalError.includes("Cannot access screen")) {
    return "Cannot access screen due to hardware or system restrictions.";
  }
  if (technicalError.includes("Screen sharing failed due to technical constraints")) {
    return "Screen sharing failed due to technical constraints. Try adjusting quality settings.";
  }
  if (technicalError.includes("Screen sharing blocked due to security")) {
    return "Screen sharing blocked due to security restrictions.";
  }
  if (technicalError.includes("Cannot share screen with yourself")) {
    return "You cannot share screen with your own ID.";
  }
  if (technicalError.includes("Already sharing screen")) {
    return "Already sharing screen. Stop current session first.";
  }
  if (technicalError.includes("Cannot share screen: The other person is unavailable")) {
    return "Cannot share screen: The other person is unavailable.";
  }
  if (technicalError.includes("Screen sharing failed due to a connection error")) {
    return "Screen sharing failed due to a connection error.";
  }
  if (technicalError.includes("Screen sharing failed due to a network problem")) {
    return "Screen sharing failed due to a network problem.";
  }

  // Default for unmatched technical errors
  // If a specific part of a technical error is good, we can try to extract it.
  // For now, a generic message for truly unmapped errors.
  // console.warn("Unmapped technical error:", technicalError); // Optional: for development
  return "An unexpected error occurred. Please try again.";
};

const useChatLogic = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [peerId, setPeerId] = useState(""); // For connection input form
  const [myId, setMyId] = useState("");
  const [disconnectReason, setDisconnectReason] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fileProgress, setFileProgress] = useState(new Map());
  const [receivingFileProgress, setReceivingFileProgress] = useState(new Map());
  const [receivedFiles, setReceivedFiles] = useState(new Map());
  const fileTimeouts = useRef(new Map());
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState("00:00");
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const audioRef = useRef(null);
  const lastSentFileNameRef = useRef(null);
  const incomingRingtoneAudioRef = useRef(null);
  const outgoingRingingAudioRef = useRef(null);
  const noAnswerTimeoutRef = useRef(null); // Added for no-answer timeout
  const [isPeerTyping, setIsPeerTyping] = useState(false); // State for peer typing status
  const peerTypingTimeoutRef = useRef(null); // Ref for peer typing timeout
  const processedFileDownloadsRef = useRef(new Set()); // Ref to track processed file downloads

  // Screen sharing states
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStatus, setScreenShareStatus] = useState('idle');
  const [screenShareType, setScreenShareType] = useState(null); // 'sending' | 'receiving' | null
  const [screenShareDuration, setScreenShareDuration] = useState('00:00');
  const [screenShareQuality, setScreenShareQuality] = useState('medium');
  const [viewingScreenShare, setViewingScreenShare] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [incomingScreenShare, setIncomingScreenShare] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const screenShareTimerRef = useRef(null);
  const screenShareStartTimeRef = useRef(null);

  // Set to track recent system messages to prevent duplicates
  const recentSystemMessagesRef = useRef(new Set());

  const cleanupFileTransfer = (fileId) => {
    if (fileTimeouts.current.has(fileId)) {
      clearTimeout(fileTimeouts.current.get(fileId));
      fileTimeouts.current.delete(fileId);
    }
  };

  useEffect(() => {
    WebRTCService.initialize();
    setMyId(localStorage.getItem("peerjs_id"));

    WebRTCService.setOnMessageCallback((data) => {
      if (typeof data === "object" && data.type === "file") {
        if (
          !data.name ||
          !data.size ||
          !data.mimeType ||
          !data.totalChunks ||
          !data.fileId
        ) {
          console.error("Invalid file metadata received:", data);
          return;
        }
        if (receivedFiles.has(data.fileId)) {
          console.warn("Duplicate file transfer detected:", data.fileId);
          return;
        }
        const timeout = setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              text: `The transfer of file '${data.name}' took too long and was cancelled. Please try sending it again.`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          setReceivedFiles((prev) => {
            const newFiles = new Map(prev);
            newFiles.delete(data.fileId);
            return newFiles;
          });
          setReceivingFileProgress((prevMap) => {
            const newMap = new Map(prevMap);
            newMap.delete(data.fileId);
            return newMap;
          });
        }, 5 * 60 * 1000);
        fileTimeouts.current.set(data.fileId, timeout);
        setReceivedFiles((prev) =>
          new Map(prev).set(data.fileId, {
            name: data.name,
            size: data.size,
            mimeType: data.mimeType,
            chunks: new Array(data.totalChunks),
            receivedChunks: 0,
            totalChunks: data.totalChunks,
            chunkSize: data.chunkSize,
            startTime: Date.now(),
            lastChunkTime: Date.now(),
          })
        );
        setReceivingFileProgress((prevMap) => 
          new Map(prevMap).set(data.fileId, { 
            fileName: data.name, 
            progress: 0 
          })
        );
        return;
      }

      if (typeof data === "object" && data.type === "fileChunk") {
        if (!data.fileId || typeof data.index !== "number" || !data.chunk) {
          console.error("Invalid chunk data received:", data);
          return;
        }
        setReceivedFiles((prev) => {
          const newFiles = new Map(prev);
          const file = newFiles.get(data.fileId);
          if (file) {
            file.lastChunkTime = Date.now();
            if (data.index < 0 || data.index >= file.totalChunks) {
              console.error("Invalid chunk index:", data.index);
              return newFiles;
            }
            file.chunks[data.index] = data.chunk;
            file.receivedChunks++;
            const progress = (file.receivedChunks / file.totalChunks) * 100;
            setReceivingFileProgress((prevMap) => {
              const newMap = new Map(prevMap);
              newMap.set(data.fileId, { fileName: file.name, progress: progress });
              return newMap;
            });
            if (fileTimeouts.current.has(data.fileId)) {
              clearTimeout(fileTimeouts.current.get(data.fileId));
              const timeout = setTimeout(() => {
                setMessages((prev) => [
                  ...prev,
                  {
                    text: `Receiving file '${file.name}' timed out. Please ask the sender to try again.`,
                    sender: "system",
                    isSystem: true,
                    time: new Date(),
                  },
                ]);
                setReceivedFiles((prev) => {
                  const newFiles = new Map(prev);
                  newFiles.delete(data.fileId);
                  return newFiles;
                });
                setReceivingFileProgress((prevMap) => {
                  const newMap = new Map(prevMap);
                  newMap.delete(data.fileId);
                  return newMap;
                });
              }, 30000);
              fileTimeouts.current.set(data.fileId, timeout);
            }
          }
          return newFiles;
        });
        return;
      }

      if (typeof data === "object" && data.type === "fileComplete") {
        if (!data.fileId) {
          console.error("Invalid file completion data:", data);
          return;
        }

        // Prevent duplicate processing of the fileComplete event
        if (processedFileDownloadsRef.current.has(data.fileId)) {
          console.warn(`[useChatLogic] fileComplete for fileId ${data.fileId} already processed. Skipping duplicate message/download.`);
          // It's possible the file was already cleaned up from receivedFiles if this is a true duplicate event later on.
          // Ensure progress bar is also cleaned up if it lingered due to an odd state.
          setReceivingFileProgress((prevMap) => {
            const newMap = new Map(prevMap);
            if (newMap.has(data.fileId)) {
                newMap.delete(data.fileId);
                console.log(`[useChatLogic] Cleaned up lingering progress for duplicate fileComplete: ${data.fileId}`);
            }
            return newMap;
          });
          return; 
        }
        // Mark as processed for this specific event instance.
        // This helps if the event itself is fired multiple times by the underlying library for any reason.
        processedFileDownloadsRef.current.add(data.fileId);
        console.log(`[useChatLogic] Started processing fileComplete for fileId ${data.fileId}`);


        setReceivedFiles((prev) => {
          const newFiles = new Map(prev);
          const file = newFiles.get(data.fileId);

          if (file) {
            try {
              cleanupFileTransfer(data.fileId); // Clear any pending timeout for this file

              const validChunks = file.chunks.filter((chunk) => chunk !== undefined);
              if (validChunks.length !== file.totalChunks) {
                // User-friendly message for missing chunks
                throw new Error(`Could not assemble '${file.name}'. Some parts of the file were missing. Please ask the sender to try again.`);
              }
              const blob = new Blob(validChunks, { type: file.mimeType });
              if (blob.size !== file.size) {
                // User-friendly message for size mismatch
                throw new Error(`Could not verify '${file.name}'. The received file size was different from the expected size. Please ask the sender to try again.`);
              }

              // Add system message for manual download
              setMessages((prevMsgs) => [
                ...prevMsgs,
                {
                  text: `File ready: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB). Click Download button.`,
                  sender: "system",
                  isSystem: true,
                  time: new Date(),
                  fileData: { // For "Download" button
                    blob: blob,
                    name: file.name,
                  }
                },
              ]);

              setReceivingFileProgress((prevMap) => {
                const map = new Map(prevMap);
                map.delete(data.fileId);
                return map;
              });
              
              newFiles.delete(data.fileId); // Remove from the map of files being received
              // We keep data.fileId in processedFileDownloadsRef to prevent reprocessing this specific fileComplete event.
              // It's cleared on unmount. If a new file with the exact same ID were to come later (highly unlikely),
              // it would be blocked unless this ref is managed more granularly (e.g., with TTL or explicit removal).

            } catch (err) {
              console.error("[useChatLogic] Error during file completion processing:", err);
              // Use the error message directly if it's one of our custom ones, otherwise map it or use a generic one.
              const fileCompletionErrorText = (err.message.startsWith("Could not assemble") || err.message.startsWith("Could not verify")) 
                ? err.message 
                : mapErrorMessageToUserFriendly(err.message || `Error processing received file: ${file.name}`);

              setMessages((prevMsgs) => [
                ...prevMsgs,
                {
                  text: fileCompletionErrorText,
                  sender: "system",
                  isSystem: true,
                  time: new Date(),
                },
              ]);
              // Ensure cleanup even on error
              newFiles.delete(data.fileId);
              setReceivingFileProgress((prevMap) => {
                const map = new Map(prevMap);
                map.delete(data.fileId);
                return map;
              });
            }
          } else {
            console.warn(`[useChatLogic] fileComplete received for ${data.fileId}, but file info not found in receivedFiles. It might have been cleared by a timeout or already processed.`);
            // If file info is gone, we can't create a blob or message for it.
            // Ensure its progress bar is cleared if it wasn't.
            setReceivingFileProgress((prevMap) => {
                const map = new Map(prevMap);
                if (map.has(data.fileId)) {
                    map.delete(data.fileId);
                    console.log(`[useChatLogic] Cleaned up lingering progress for missing file info: ${data.fileId}`);
                }
                return map;
            });
             // Since we added to processedFileDownloadsRef at the top, and can't process this,
             // remove it to allow a potential legitimate (though unlikely) future retry if needed.
             // However, this path indicates an issue, likely a race condition with timeouts.
            processedFileDownloadsRef.current.delete(data.fileId);
          }
          return newFiles;
        });
        return;
      }

      if (typeof data === "object") {
        switch (data.type) {
          case "message":
            setMessages((prev) => [
              ...prev,
              { text: data.content, sender: "peer", time: new Date() },
            ]);
            // If peer sends a message, they are no longer typing
            setIsPeerTyping(false);
            if (peerTypingTimeoutRef.current) {
              clearTimeout(peerTypingTimeoutRef.current);
              peerTypingTimeoutRef.current = null;
            }
            break;
          case "call_ringing_ack":
            if (callStatus === 'dialing') {
              setCallStatus("opponent_ringing");
              playAudio(outgoingRingingAudioRef, true);
            }
            break;
          case "session_full":
            setError("The peer is already in a session with someone else.");
            setConnected(false);
            setIsConnecting(false);
            break;
          case "disconnect":
            fileTimeouts.current.forEach((timeout) => {
              clearTimeout(timeout);
            });
            fileTimeouts.current.clear();
            
            let disconnectMsg = "The other person has disconnected."; // Default
            if (data.reason === 'browser_close') {
              disconnectMsg = "The other person appears to have left or closed their browser.";
            } else if (data.reason === 'user_disconnect') {
              disconnectMsg = "The other person has ended the session.";
            } else if (data.message) { // Fallback to data.message if reason is not specific enough
                disconnectMsg = data.message;
            }

            setMessages((prev) => [
              ...prev,
              {
                text: disconnectMsg, // Use the new user-friendly message
                sender: "system",
                isSystem: true,
                time: new Date(),
              },
            ]);
            setDisconnectReason(data.reason);
            setConnected(false);
            setIsConnecting(false);
            setIsPeerTyping(false); // Reset peer typing on disconnect
            if (peerTypingTimeoutRef.current) {
              clearTimeout(peerTypingTimeoutRef.current);
              peerTypingTimeoutRef.current = null;
            }
            break;
          case "typing_started":
            setIsPeerTyping(true);
            // Clear previous timeout if any
            if (peerTypingTimeoutRef.current) {
              clearTimeout(peerTypingTimeoutRef.current);
            }
            // Set a timeout to automatically set isPeerTyping to false if no "typing_stopped" or new message comes
            peerTypingTimeoutRef.current = setTimeout(() => {
              setIsPeerTyping(false);
              peerTypingTimeoutRef.current = null;
            }, 3000); // Assume typing stopped after 3 seconds of no activity
            break;
          case "typing_stopped":
            setIsPeerTyping(false);
            if (peerTypingTimeoutRef.current) {
              clearTimeout(peerTypingTimeoutRef.current);
              peerTypingTimeoutRef.current = null;
            }
            break;
          default:
            console.warn("Unknown message type:", data.type);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { text: data, sender: "peer", time: new Date() },
        ]);
      }
    });

    WebRTCService.setOnFileProgressCallback(({ fileName, progress, fileId }) => {
      setFileProgress((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(fileId, { fileName, progress });
        return newMap;
      });

      if (progress === 100) {
        setTimeout(() => {
          setFileProgress((prevMap) => {
            const newMap = new Map(prevMap);
            newMap.delete(fileId);
            return newMap;
          });
          setMessages((prev) => [
            ...prev,
            {
              text: `File sent: ${fileName}`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
        }, 1000);
      }
    });

    WebRTCService.setOnPeerConnectedCallback((connectedPeerId) => { // Renamed arg to avoid clash
      setPeerId(connectedPeerId); // This sets the connected peer's ID
      setConnected(true);
      setDisconnectReason(null);
      setIsConnecting(false); // Ensure connecting state is false
      setMessages((prev) => [
        ...prev,
        {
          text: "Connected to peer!",
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);
    });
    
    // Call status callback setup
    WebRTCService.setOnCallStatusCallback((status, streamOrCall, errorMsg) => {
      // Clear no-answer timeout if call becomes active, ends, or errors out
      if (noAnswerTimeoutRef.current && (status === 'active' || status === 'ended' || status === 'error')) {
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
        console.log("No answer timeout cleared due to call status change:", status);
      }

      switch (status) {
        case "incoming":
          setCallStatus("incoming_ringing");
          playAudio(incomingRingtoneAudioRef, true);
          setMessages((prev) => [
            ...prev,
            {
              text: `Incoming call from ${streamOrCall.peer}...`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          // Store the incoming call object for the UI to handle
          setIncomingCall(streamOrCall);
          break;
        case "connecting":
          setCallStatus("dialing");
          break;
        case "active":
          pauseAudio(incomingRingtoneAudioRef);
          pauseAudio(outgoingRingingAudioRef);
          setIsCallActive(true);
          setCallStatus("active");
          startCallTimer();
          if (audioRef.current && streamOrCall) {
            audioRef.current.srcObject = streamOrCall;
            audioRef.current.play().catch(e => {
              console.error("Error playing audio:", e);
              setError(mapErrorMessageToUserFriendly("Could not play call audio."));
            });
          }
          setMessages((prev) => [
            ...prev,
            {
              text: "Call connected.",
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          break;
        case "ended":
          // Capture previous status to determine if it was a cancelled outgoing call
          const previousCallStatus = callStatus;

          pauseAudio(incomingRingtoneAudioRef);
          pauseAudio(outgoingRingingAudioRef);
          setIsCallActive(false);
          setCallStatus("ended"); // Set to ended first
          setIncomingCall(null); // Clear incoming call
          stopCallTimer();
          
          const lastMessage = messages[messages.length -1];
          let callEndedMessageText = `Call ended. Duration: ${callDuration}`;

          // If the call was cancelled during dialing or opponent_ringing and duration is 00:00
          if ((previousCallStatus === 'dialing' || previousCallStatus === 'opponent_ringing') && callDuration === "00:00") {
            callEndedMessageText = "Call cancelled.";
          }

          // Avoid duplicate "Call ended" or "Call cancelled" messages
          if (!lastMessage || 
              (!lastMessage.text.includes("Call ended") && 
               !lastMessage.text.includes("Call cancelled") && 
               !lastMessage.text.includes("did not answer"))) { // Also check for no-answer message
            setMessages((prev) => [
              ...prev,
              {
                text: callEndedMessageText,
                sender: "system",
                isSystem: true,
                time: new Date(),
              },
            ]);
          }
          break;
        case "error":
          pauseAudio(incomingRingtoneAudioRef);
          pauseAudio(outgoingRingingAudioRef);
          console.error("Call error from WebRTCService callback:", errorMsg);
          const userFriendlyError = mapErrorMessageToUserFriendly(errorMsg?.message || errorMsg || "Call error occurred");
          setError(userFriendlyError);
          setIsCallActive(false);
          setCallStatus("error");
          setIncomingCall(null); // Clear incoming call
          stopCallTimer();
          if (audioRef.current) {
            audioRef.current.srcObject = null;
          }
          setMessages((prev) => [
            ...prev,
            {
              text: userFriendlyError.startsWith("Call failed") ? userFriendlyError : `Call failed: ${userFriendlyError}`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          break;
        default:
            console.warn("Unknown call status:", status);
            setError(mapErrorMessageToUserFriendly(`Unknown call status: ${status}`));
      }
    });

    // Screen sharing callback
    WebRTCService.setOnScreenShareStatusCallback((status, stream, errorMessage, shareType) => {
      setScreenShareStatus(status);
      if (status === "active") {
        setIsScreenSharing(true);
        setScreenShareType(shareType);
        setScreenShareStream(stream);
        setViewingScreenShare(shareType === 'receiving');
        startScreenShareTimer();
        
        const message = shareType === 'sending' 
          ? "You are now sharing your screen."
          : "You are now viewing a shared screen.";
        
        setMessages((prev) => [
          ...prev,
          {
            text: message,
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);
      } else if (status === "ended") {
        setIsScreenSharing(false);
        setScreenShareType(null);
        setScreenShareStream(null);
        setViewingScreenShare(false);
        setIncomingScreenShare(null);
        stopScreenShareTimer();
        
        // Use unique message function to prevent duplicates
        addUniqueSystemMessage("Screen sharing has ended.");
      } else if (status === "incoming") {
        setIncomingScreenShare(stream);
        setMessages((prev) => [
          ...prev,
          {
            text: `${stream.peer} wants to share their screen with you.`,
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);
      } else if (status === "connecting") {
        const message = shareType === 'sending' 
          ? "Initiating screen share..."
          : "Connecting to screen share...";
        
        setMessages((prev) => [
          ...prev,
          {
            text: message,
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);
      } else if (status === "error") {
        setIsScreenSharing(false);
        setScreenShareType(null);
        setScreenShareStream(null);
        setViewingScreenShare(false);
        setIncomingScreenShare(null);
        stopScreenShareTimer();
        
        const friendlyError = mapErrorMessageToUserFriendly(errorMessage);
        setError(friendlyError);
        setMessages((prev) => [
          ...prev,
          {
            text: friendlyError,
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);
      }
    });

    return () => {
      fileTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      fileTimeouts.current.clear();
      if (noAnswerTimeoutRef.current) { // Clear no-answer timeout on unmount
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }
      if (peerTypingTimeoutRef.current) { // Clear peer typing timeout on unmount
        clearTimeout(peerTypingTimeoutRef.current);
        peerTypingTimeoutRef.current = null;
      }
      if (screenShareTimerRef.current) { // Clear screen share timer on unmount
        clearInterval(screenShareTimerRef.current);
        screenShareTimerRef.current = null;
      }
      processedFileDownloadsRef.current.clear(); // Clear on unmount
      pauseAudio(incomingRingtoneAudioRef);
      pauseAudio(outgoingRingingAudioRef);
      WebRTCService.endCall(); // Ensure call is ended on unmount
      WebRTCService.endScreenShare(); // Ensure screen share is ended on unmount
      stopCallTimer(); // Stop call timer
      stopScreenShareTimer(); // Stop screen share timer
      WebRTCService.disconnect();
      setIsConnecting(false); // Reset connecting state
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isToday = (date) => {
    const d = new Date(date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  const handleConnect = async (idToConnect) => { // Changed peerId arg to idToConnect
    const id = idToConnect.trim();
    if (!id) {
      setError("Please enter the ID of the person you want to connect with.");
      return;
    }

    try {
      setError("");
      setIsConnecting(true);
      const timeoutPromise = new Promise((_, reject) => {
        // User-friendly timeout message for the promise
        setTimeout(() => reject(new Error("Connection attempt timed out. Please check the ID and try again, or ask the other person to connect to you instead.")), 10000);
      });
      await Promise.race([WebRTCService.connectToPeer(id), timeoutPromise]);
      // Connection success is handled by onPeerConnectedCallback
      // setConnected(true) and setDisconnectReason(null) are handled there
    } catch (err) {
      const specificError = err.message === "Connection attempt timed out. Please check the ID and try again, or ask the other person to connect to you instead." 
                             ? err.message 
                             : mapErrorMessageToUserFriendly(err.message || "Failed to connect");
      setError(specificError);
      console.error("Connection error in handleConnect:", err);
      setConnected(false); 
      setIsConnecting(false); 

      // Reload the page after 5 seconds on connection error
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    }
  };

  const handleSendMessage = (currentPeerId, messageContent) => { // Pass peerId and messageContent
    const text = messageContent.trim();
    if (!text || !currentPeerId) return; // Ensure peerId is available
    setMessages((prev) => [...prev, { text, sender: "me", time: new Date() }]);
    WebRTCService.sendMessage(currentPeerId, text);
    // setInputMessage(""); // This will be handled by the component
  };

  const handleEndSession = () => {
    setIsConnecting(false);
    WebRTCService.disconnect(); // This will trigger the 'disconnect' message via onMessageCallback
    setDisconnectReason("user_disconnect");
    setConnected(false);
    // Clear no-answer timeout if a session is ended abruptly
    if (noAnswerTimeoutRef.current) {
      clearTimeout(noAnswerTimeoutRef.current);
      noAnswerTimeoutRef.current = null;
    }
    // Clear messages after a short delay to allow disconnect message to be sent/received
    setTimeout(() => {
      setMessages([]);
       // Reloading window should be a component concern, not hook.
       // For now, let's keep it but it's better handled in Chat.jsx
      setTimeout(() => {
        window.location.reload();
      }, 3000); // Changed from 2000 to 3000
    }, 1000);
  };

  const handleCopyId = () => {
    if(myId) {
      navigator.clipboard.writeText(myId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleFileSelect = async (file, currentPeerId) => { // Pass file and peerId
    if (!file || !currentPeerId) {
      setError(mapErrorMessageToUserFriendly("No file selected or not connected to a peer."));
      return;
    }
     if (file.size === 0) {
      setError(mapErrorMessageToUserFriendly("Cannot send empty file"));
      setMessages((prev) => [
        ...prev,
        {
          text: `Could not send file: '${file.name}' is empty.`,
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);
      return;
    }

    try {
      setError(""); // Clear previous errors
      await WebRTCService.sendFile(currentPeerId, file);
      // Message for successful send is now handled by onFileProgressCallback (progress 100%)
    } catch (err) {
      let userMessage;
      if (err.message.includes("exceeds limit")) {
        userMessage = err.message; // This is already user-friendly
      } else if (err.message.includes("No open connection")) {
        userMessage = "Connection lost. Please reconnect to send files.";
      } else if (err.message.includes("Cannot send empty file")) {
        userMessage = "Cannot send an empty file. Please select a file with content.";
      } else {
        // Generic message for other errors caught by sendFile
        userMessage = mapErrorMessageToUserFriendly("Could not send the file. " + (err.message || ""));
      }
      setError(userMessage);
      setMessages((prev) => [ 
        ...prev,
        {
          text: `Failed to send file '${file.name}'. Reason: ${userMessage}`,
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);
    }
  };
  
  const startCallTimer = () => {
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      const duration = Math.floor(
        (Date.now() - callStartTimeRef.current) / 1000
      );
      const minutes = Math.floor(duration / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (duration % 60).toString().padStart(2, "0");
      setCallDuration(`${minutes}:${seconds}`);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration("00:00"); // Reset duration
  };

  const startScreenShareTimer = () => {
    screenShareStartTimeRef.current = Date.now();
    screenShareTimerRef.current = setInterval(() => {
      const duration = Math.floor(
        (Date.now() - screenShareStartTimeRef.current) / 1000
      );
      const minutes = Math.floor(duration / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (duration % 60).toString().padStart(2, "0");
      setScreenShareDuration(`${minutes}:${seconds}`);
    }, 1000);
  };

  const stopScreenShareTimer = () => {
    if (screenShareTimerRef.current) {
      clearInterval(screenShareTimerRef.current);
      screenShareTimerRef.current = null;
    }
    setScreenShareDuration("00:00");
  };

  const handleStartCall = async (currentPeerId) => { // Pass peerId
    if (currentPeerId) {
      setError(""); 
      setCallStatus("dialing"); 

      if (noAnswerTimeoutRef.current) {
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }
      
      setMessages((prev) => [
        ...prev,
        {
          text: `Attempting to call ${currentPeerId}...`,
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);

      const success = await WebRTCService.startCall(currentPeerId);
      if (success) {
        playAudio(outgoingRingingAudioRef, true);

        noAnswerTimeoutRef.current = setTimeout(() => {
          console.log(`No answer timeout triggered for call to ${currentPeerId}.`);
          WebRTCService.endCall(); 
          setMessages((prev) => [
            ...prev,
            {
              text: `${currentPeerId} did not answer. Call ended.`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          setError(`${currentPeerId} did not answer the call.`);
          noAnswerTimeoutRef.current = null; 
        }, NO_ANSWER_TIMEOUT_DURATION);

      } else {
        pauseAudio(outgoingRingingAudioRef); 
        setCallStatus("error"); 
        const currentError = error;
        if (!currentError) {
          const specificError = mapErrorMessageToUserFriendly("Failed to start call. Peer might not be available or a connection issue occurred.");
          setError(specificError);
          setMessages((prev) => [
            ...prev,
            {
              text: specificError,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
        }
      }
    } else {
        setError(mapErrorMessageToUserFriendly("Cannot start call: No peer connected."));
         setMessages((prev) => [
            ...prev,
            {
              text: "Cannot start a call as you are not connected to anyone.",
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
    }
  };

  const handleEndCall = () => {
    // Clear no-answer timeout if active when user manually ends call
    if (noAnswerTimeoutRef.current) {
      clearTimeout(noAnswerTimeoutRef.current);
      noAnswerTimeoutRef.current = null;
    }
    pauseAudio(incomingRingtoneAudioRef); // Added
    pauseAudio(outgoingRingingAudioRef); // Added
    WebRTCService.endCall();
    // Message for call ended is now handled in 'ended' status of setOnCallStatusCallback
  };

  const handleMuteToggle = () => {
    const newMuteState = WebRTCService.toggleMute();
    setIsMuted(newMuteState);
  };

  // Helper to safely play audio
  const playAudio = async (audioRefInstance, loop = false) => {
    if (audioRefInstance.current) {
      audioRefInstance.current.loop = loop;
      try {
        await audioRefInstance.current.play();
      } catch (error) {
        console.warn("Error playing audio:", error);
        // Autoplay may be blocked, user interaction might be needed
        // Or the src might not be loaded yet.
      }
    }
  };

  // Helper to safely pause audio
  const pauseAudio = (audioRefInstance) => {
    if (audioRefInstance.current && !audioRefInstance.current.paused) {
      audioRefInstance.current.pause();
      audioRefInstance.current.currentTime = 0; // Reset audio to start
    }
  };

  const notifyTypingState = (peerId, isTyping) => {
    if (peerId) {
      WebRTCService.sendMessage(peerId, { type: isTyping ? "typing_started" : "typing_stopped" });
    }
  };

  // Screen sharing handlers
  const handleStartScreenShare = async (currentPeerId, options = {}) => {
    if (currentPeerId) {
      setError("");
      setScreenShareStatus("connecting");
      
      setMessages((prev) => [
        ...prev,
        {
          text: `Starting screen share with ${currentPeerId}...`,
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);

      const success = await WebRTCService.startScreenShare(currentPeerId, options);
      if (!success) {
        setScreenShareStatus("error");
        const currentError = error;
        if (!currentError) {
          const specificError = mapErrorMessageToUserFriendly("Failed to start screen share. Please check permissions and try again.");
          setError(specificError);
          setMessages((prev) => [
            ...prev,
            {
              text: specificError,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
        }
      }
    } else {
      setError(mapErrorMessageToUserFriendly("Cannot start screen share: No peer connected."));
      setMessages((prev) => [
        ...prev,
        {
          text: "Cannot start screen share as you are not connected to anyone.",
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);
    }
  };

  const handleStopScreenShare = () => {
    WebRTCService.endScreenShare();
  };

  const handleAnswerScreenShare = async (screenCall) => {
    if (screenCall) {
      const success = await WebRTCService.answerScreenShare(screenCall);
      if (success) {
        setIncomingScreenShare(null);
      }
    }
  };

  const handleRejectScreenShare = (screenCall) => {
    if (screenCall) {
      WebRTCService.rejectScreenShare(screenCall);
      setIncomingScreenShare(null);
      setMessages((prev) => [
        ...prev,
        {
          text: "Screen share request rejected.",
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);
    }
  };

  const handleScreenShareQualityChange = (quality) => {
    setScreenShareQuality(quality);
  };

  // Call answer/reject handlers
  const handleAnswerCall = async () => {
    if (incomingCall) {
      pauseAudio(incomingRingtoneAudioRef);
      const success = await WebRTCService.answerCall(incomingCall);
      if (success) {
        setIncomingCall(null);
      }
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      pauseAudio(incomingRingtoneAudioRef);
      WebRTCService.rejectCall(incomingCall);
      setIncomingCall(null);
      setCallStatus("ended");
      setMessages((prev) => [
        ...prev,
        {
          text: "Incoming call rejected.",
          sender: "system",
          isSystem: true,
          time: new Date(),
        },
      ]);
    }
  };

  // Helper function to add unique system messages
  const addUniqueSystemMessage = (messageText) => {
    // Check if this exact message was recently added
    if (recentSystemMessagesRef.current.has(messageText)) {
      console.log('Duplicate system message prevented:', messageText);
      return;
    }
    
    // Add to recent messages set
    recentSystemMessagesRef.current.add(messageText);
    
    // Clean up old messages after 5 seconds
    setTimeout(() => {
      recentSystemMessagesRef.current.delete(messageText);
    }, 5000);
    
    // Add the message
    setMessages((prev) => [
      ...prev,
      {
        text: messageText,
        sender: "system",
        isSystem: true,
        time: new Date(),
      },
    ]);
  };

  // The 'peerId' state in this hook represents the *connected* peer's ID after successful connection.
  // For the input field, the Chat.jsx component will manage its own state, let's call it 'peerIdInput'.
  // The handleConnect function will take this 'peerIdInput' as an argument.
  // This avoids confusion with the 'peerId' state which stores the ID of the currently connected peer.

  return {
    connected,
    messages,
    inputMessage,
    setInputMessage, // For controlled input in Chat.jsx
    // peerId, // This is the connected peer's ID, Chat.jsx uses it for display or sending
    myId,
    disconnectReason,
    isConnecting,
    error,
    setError, // Allow component to clear error
    copied,
    fileProgress,
    receivingFileProgress,
    isCallActive,
    callStatus,
    isMuted,
    callDuration,
    audioRef, // For the <audio> element in Chat.jsx
    incomingRingtoneAudioRef, // Added
    outgoingRingingAudioRef, // Added

    // Screen sharing states
    isScreenSharing,
    screenShareStatus,
    screenShareType,
    screenShareDuration,
    screenShareQuality,
    viewingScreenShare,
    screenShareStream,
    incomingScreenShare,
    
    // Call states
    incomingCall,

    handleConnect, // Takes peerIdToConnect (from input in Chat.jsx)
    handleSendMessage, // Takes connectedPeerId, messageContent
    handleEndSession,
    handleCopyId,
    handleFileSelect, // Takes file, connectedPeerId
    handleStartCall, // Takes connectedPeerId
    handleEndCall,
    handleMuteToggle,
    notifyTypingState, // Function to notify typing state
    isPeerTyping, // Peer typing status
    formatTime,
    isToday,
    
    // Screen sharing handlers
    handleStartScreenShare, // Takes connectedPeerId, options
    handleStopScreenShare,
    handleAnswerScreenShare, // Takes screenCall
    handleRejectScreenShare, // Takes screenCall
    handleScreenShareQualityChange, // Takes quality
    
    // Call handlers
    handleAnswerCall,
    handleRejectCall,
    
    // The actual connected peer's ID is also returned for use in handlers that need it
    // The component will have an input field state for peer ID to connect to.
    // Let's rename the state 'peerId' to 'connectedPeerId' in the hook for clarity,
    // and the input field in Chat.jsx can use its own 'peerIdToConnect' state.
    // For now, I'll keep 'peerId' as the connected peer's ID and make sure handlers use it correctly.
    // The `peerId` state will be updated by `setOnPeerConnectedCallback`.
    // The `handleConnect` function in the hook will take the ID from the input field as an argument.
    // The Chat.jsx will need a state for the input field, e.g. `peerIdInputValue`, and pass it to `handleConnect`.
    // The `peerId` returned from the hook is the ID of the *connected* peer.
    connectedPeerId: peerId, // Explicitly naming the connected peer's ID
    setPeerId // Allow component to set peerId (e.g. from input field for connecting) - NO, this is for connected peer.
               // The component will need its own state for the input field.
  };
};

export default useChatLogic; 