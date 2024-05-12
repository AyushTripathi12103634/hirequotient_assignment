import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function Username() {
  const [username, setUsername] = useState("");
  const user = (e) => {
    e.preventDefault();
    localStorage.setItem("Username",username)
  }
  return (
    <div className='d-flex justify-content-center align-items-center' style={{ "height": "100vh" }}>
      <div className="form-group w-25 border p-5 rounded border-5">
        <h4>Set Your Username</h4>
        <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <button className="btn btn-primary mt-2" onClick={user}>Set Username</button>
      </div>
    </div>
  )
}

function Rooms({ roomId, setRoomId }) {
  const [rooms, setRooms] = useState([]);
  const username = localStorage.getItem("Username");

  useEffect(() => {
    fetch(`http://localhost:5000/rooms/${username}`)
      .then(response => response.json())
      .then(data => {
        console.log(data);
        setRooms(Object.values(data.rooms))
      })
      .catch(error => console.log("Error:", error));
  }, []);

  useEffect(() => {
    console.log(rooms);
  }, [rooms]);

  const createroom = (e) => {
    e.preventDefault();
    fetch(`http://localhost:5000/setroom/${username}`, {
      method: "POST"
    })
      .then(response => response.json())
      .then(data => alert("Room id: " + data.room))
      .catch(error => console.log("Error: ", error))

    fetch(`http://localhost:5000/rooms/${username}`)
      .then(response => response.json())
      .then(data => setRooms(Object.keys(data.rooms)))
      .catch(error => console.log("Error:", error));
  }

  const [searchroom, setsearchroom] = useState("");

  return (
    <div className="container mt-3">
      <h2>Rooms</h2>
      <input className="form-control" placeholder='search room' onChange={(e) => { setsearchroom(e.target.value) }}></input>
      <button className="btn btn-primary mt-2" onClick={() => {
        socket.emit('join room', searchroom, username);
        setRoomId(searchroom);
      }}>Join {searchroom}</button>
      <button className="btn btn-success mt-2" onClick={createroom}>Create Room</button>
      {rooms.map(room => (
        <button className="btn btn-info mt-2" key={room.roomid} onClick={() => {
          socket.emit('join room', room.roomid, username);
          setRoomId(room.roomid);
        }}>
          Join {room.roomid}
        </button>
      ))}
    </div>
  );
}

function ChatRoom({ roomId, setRoomId }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const username = localStorage.getItem("Username");

  useEffect(() => {
    socket.on('new message', (msg) => {
      setMessages(messages => [...messages, msg]);
    });
    socket.on('old messages', (oldMessages) => {
      setMessages(Array.isArray(oldMessages) ? oldMessages : []);
    });
  }, []);

  const sendMessage = () => {
    if (roomId) {
      socket.emit('send message', roomId, message);
      setMessage("");
    } else {
      alert("Please join a room first");
    }
  };

  return (
    <div className="container mt-3">
      <h2>Chat Room</h2>
      {Array.isArray(messages) && messages.map((msg, index) => (
        <p key={index}><strong>{msg.user}:</strong> {msg.text} <span className="text-muted">{new Date(msg.timestamp).toLocaleString()}</span></p>
      ))}
      <input className="form-control" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" />
      <button className="btn btn-primary mt-2" onClick={sendMessage}>Send</button>
    </div>
  );
}



function App() {
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem("Username"));

  useEffect(() => {
    setUsername(localStorage.getItem("Username"));
  }, []);

  return (
    <div className="container">
      {username ?
        <>
          <Rooms roomId={roomId} setRoomId={setRoomId} />
          <ChatRoom roomId={roomId} setRoomId={setRoomId} />
        </> :
        <Username setUsername={setUsername} />
      }
    </div>
  );
}

export default App;
