import { useState, useEffect, useRef } from "react";
import WebRTCService from "../services/WebRTCService";

const NO_ANSWER_TIMEOUT_DURATION = 15000; // 15 seconds

const useChatLogic = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [peerId, setPeerId] = useState(""); // For connection input form
  const [myId, setMyId] = useState("");
  const [disconnectReason, setDisconnectReason] = useState(null);
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
              text: `File transfer timeout: ${data.name}`,
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
        setMessages((prev) => [
          ...prev,
          {
            text: `Received file: ${data.name}`,
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);
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
                    text: `File transfer timeout: ${file.name}`,
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
        setReceivedFiles((prev) => {
          const newFiles = new Map(prev);
          const file = newFiles.get(data.fileId);
          if (file) {
            try {
              cleanupFileTransfer(data.fileId);
              const validChunks = file.chunks.filter(
                (chunk) => chunk !== undefined
              );
              if (validChunks.length !== file.totalChunks) {
                const missingChunks = file.totalChunks - validChunks.length;
                throw new Error(
                  `Missing ${missingChunks} chunks out of ${file.totalChunks}`
                );
              }
              for (let i = 0; i < file.chunks.length; i++) {
                if (file.chunks[i] === undefined) {
                  throw new Error(`Missing chunk at index ${i}`);
                }
              }
              const blob = new Blob(validChunks, { type: file.mimeType });
              if (blob.size !== file.size) {
                throw new Error(
                  `File size mismatch: received ${blob.size} bytes, expected ${file.size} bytes`
                );
              }
              if (!blob.type.startsWith(file.mimeType.split("/")[0])) {
                throw new Error(
                  `File type mismatch: received ${blob.type}, expected ${file.mimeType}`
                );
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = file.name;
              a.click();
              URL.revokeObjectURL(url);
              const transferTime = (
                (Date.now() - file.startTime) /
                1000
              ).toFixed(1);
              const speed = (
                file.size /
                (1024 * 1024) /
                (transferTime / 60)
              ).toFixed(2); // MB/min
              if (peerId && peerId !== myId) { // peerId here refers to the connected peer's ID, from state
                setMessages((prev) => [
                  ...prev,
                  {
                    text: `Received file: ${file.name} (${(
                      file.size /
                      (1024 * 1024)
                    ).toFixed(2)}MB in ${transferTime}s, ${speed}MB/min)`,
                    sender: "system",
                    isSystem: true,
                    time: new Date(),
                  },
                ]);
              }
              setReceivingFileProgress((prevMap) => {
                const newMap = new Map(prevMap);
                newMap.delete(data.fileId);
                return newMap;
              });
            } catch (err) {
              console.error("Error creating file:", err);
              setMessages((prev) => [
                ...prev,
                {
                  text: `Error receiving file: ${file.name} - ${err.message}`,
                  sender: "system",
                  isSystem: true,
                  time: new Date(),
                },
              ]);
            }
            newFiles.delete(data.fileId);
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
            setMessages((prev) => [
              ...prev,
              {
                text: data.message,
                sender: "system",
                isSystem: true,
                time: new Date(),
              },
            ]);
            setDisconnectReason(data.reason);
            setConnected(false);
            setIsConnecting(false);
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
          if (window.confirm("Incoming call. Accept?")) {
            pauseAudio(incomingRingtoneAudioRef);
            WebRTCService.answerCall(streamOrCall);
          } else {
            pauseAudio(incomingRingtoneAudioRef);
            WebRTCService.rejectCall(streamOrCall);
            setCallStatus("ended");
          }
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
            audioRef.current.play().catch(e => console.error("Error playing audio:", e));
          }
          break;
        case "ended":
          pauseAudio(incomingRingtoneAudioRef);
          pauseAudio(outgoingRingingAudioRef);
          setIsCallActive(false);
          setCallStatus("ended");
          stopCallTimer();
          setMessages((prev) => [
            ...prev,
            {
              text: `Call ended at ${formatTime(new Date())}`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          break;
        case "error":
          pauseAudio(incomingRingtoneAudioRef);
          pauseAudio(outgoingRingingAudioRef);
          console.error("Call error:", errorMsg);
          setError(errorMsg?.message || "Call error occurred");
          setIsCallActive(false);
          setCallStatus("error");
          stopCallTimer();
          if (audioRef.current) {
            audioRef.current.srcObject = null;
          }
          break;
        default:
            console.warn("Unknown call status:", status);
      }
    });


    return () => {
      fileTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      fileTimeouts.current.clear();
      if (noAnswerTimeoutRef.current) { // Clear no-answer timeout on unmount
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }
      pauseAudio(incomingRingtoneAudioRef);
      pauseAudio(outgoingRingingAudioRef);
      WebRTCService.endCall(); // Ensure call is ended on unmount
      stopCallTimer(); // Stop call timer
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
      setError("Please enter a peer ID");
      return;
    }

    try {
      setError("");
      setIsConnecting(true);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timeout")), 10000);
      });
      await Promise.race([WebRTCService.connectToPeer(id), timeoutPromise]);
      // Connection success is handled by onPeerConnectedCallback
      // setConnected(true) and setDisconnectReason(null) are handled there
    } catch (err) {
      setError("Failed to connect: " + (err.message || "Unknown error"));
      console.error("Connection error:", err);
      WebRTCService.disconnect(); // Ensure cleanup
      WebRTCService.initialize(); // Reinitialize
      setConnected(false); // Explicitly set connected to false on error
      setIsConnecting(false); // Reset connecting state
    }
    //setIsConnecting(false); // Moved to onPeerConnected or catch
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
      }, 2000);
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
    if (!file || !currentPeerId) return;

    try {
      setError(""); // Clear previous errors
      await WebRTCService.sendFile(currentPeerId, file);
      // lastSentFileNameRef.current = file.name; // This is now handled by onFileProgressCallback
    } catch (err) {
      let errorMessage = "Failed to send file: ";
      if (err.message.includes("exceeds limit")) {
        errorMessage = err.message;
      } else if (err.message.includes("No open connection")) {
        errorMessage = "Connection lost. Please reconnect to send files.";
      } else {
        errorMessage += err.message || "Unknown error";
      }
      setError(errorMessage);
      setMessages((prev) => [ // Also show error as a system message
        ...prev,
        {
          text: `Failed to send file: ${file.name} - ${errorMessage}`,
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

  const handleStartCall = async (currentPeerId) => { // Pass peerId
    if (currentPeerId) {
      setError(""); // Clear previous errors
      setCallStatus("dialing"); // Set status to dialing immediately

      // Clear any previous no-answer timeout first
      if (noAnswerTimeoutRef.current) {
        clearTimeout(noAnswerTimeoutRef.current);
        noAnswerTimeoutRef.current = null;
      }

      const success = await WebRTCService.startCall(currentPeerId);
      if (success) {
        setMessages((prev) => [
          ...prev,
          {
            text: `Calling ${currentPeerId}...`, // Updated message
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);

        // Set the no-answer timeout
        noAnswerTimeoutRef.current = setTimeout(() => {
          // This timeout executes if the call wasn't answered/connected in time
          console.log(`No answer timeout triggered for call to ${currentPeerId}.`);
          
          // Check if call is still in a pending state (dialing/ringing)
          // This check is implicitly handled because if it became 'active', 'ended', or 'error',
          // the timeout would have been cleared by setOnCallStatusCallback.
          // So, if this timeout runs, the call is presumed not answered.

          WebRTCService.endCall(); // This will trigger 'ended' status via onCallStatusCallback
          setMessages((prev) => [
            ...prev,
            {
              text: `Peer did not answer. Call to ${currentPeerId} ended.`,
              sender: "system",
              isSystem: true,
              time: new Date(),
            },
          ]);
          noAnswerTimeoutRef.current = null; // Clear the ref after firing
        }, NO_ANSWER_TIMEOUT_DURATION);

      } else {
        pauseAudio(outgoingRingingAudioRef); // Ensure outgoing ringing stops if startCall fails immediately
        setCallStatus("error"); // Reset status
        setError("Failed to start call. Ensure peer is connected and available.");
        setMessages((prev) => [
          ...prev,
          {
            text: "Failed to start call. Peer might not be available.",
            sender: "system",
            isSystem: true,
            time: new Date(),
          },
        ]);
      }
    } else {
        setError("Cannot start call: No peer connected.");
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

    handleConnect, // Takes peerIdToConnect (from input in Chat.jsx)
    handleSendMessage, // Takes connectedPeerId, messageContent
    handleEndSession,
    handleCopyId,
    handleFileSelect, // Takes file, connectedPeerId
    handleStartCall, // Takes connectedPeerId
    handleEndCall,
    handleMuteToggle,
    formatTime,
    isToday,
    
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