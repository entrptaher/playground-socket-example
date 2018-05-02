const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const Datastore = require("nedb");

// by default will run on port 3000
const port = process.env.PORT || 3000;
server.listen(port);

// create a sample nedb database and automatically load it for next usage
const db = new Datastore({ filename: "cars", autoload: true });

/**
 * Get last x locations for specific car
 * @param {String} id 
 * @param {Number} limit
 */
function getLast({ id, limit = 0 }) {
  return new Promise((resolve, reject) => {
    
    // find specific car
    db.findOne({ _id: id }, (err, doc) => {
      if (err) {
        return reject(err);
      }
      try {
        // extract the location
        const { location } = doc;
        // cut of specific part from location array
        const response = location.slice(
          location.length - limit,
          location.length
        );
        resolve(response);
      } catch (e) {
        return reject(e);
      }
    });
  });
}

// simple html pages
app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/views/index.html`);
});

app.get("/user", (req, res) => {
  res.sendFile(`${__dirname}/views/user.html`);
});

app.get("/listener", (req, res) => {
  res.sendFile(`${__dirname}/views/listener.html`);
});

// socket controller
io.on("connection", socket => {
  console.log("user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  // if user wants to join a room, add them and send success
  socket.on("join", (data, fn) => {
    console.log(data, fn);
    socket.join(data.room);
    fn({ status: "ok", room: data.room });
  });

  // user sends location data
  socket.on("clientData", data => {
    // save the location data on database
    db.update(
      { _id: data.id },
      { $push: { location: data.location } },
      { upsert: true }, // if collection is not available then create it
      (err, numReplaced, upsert) => {
        // console.log(err, numReplaced, upsert);
      }
    );
    // emit the data to all users/listeners except the sender
    socket.to(data.room).emit("getClientData", data);
  });

  // listen for speicific car data
  socket.on("getSingleData", (data, fn) => {
    const id = data.id;
    const limit = data.limit;
    
    // get the data and send in callback
    getLast({ id, limit })
      .then(locationList => {
        fn({ room: "cars", id: data.id, locationList });
      })
      .catch(e => {
        fn({ error: "Got an error" });
      });
  });
});
