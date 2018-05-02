const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const Datastore = require("nedb");
const port = process.env.PORT || 3000;
server.listen(port);

const db = new Datastore({ filename: "cars", autoload: true });

function getLast({ id, limit = 0 }) {
  return new Promise((resolve, reject) => {
    db.findOne({ _id: id }, (err, doc) => {
      if (err) {
        return reject(err);
      }
      try {
        const { location } = doc;
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

app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/views/index.html`);
});

app.get("/user", (req, res) => {
  res.sendFile(`${__dirname}/views/user.html`);
});

app.get("/listener", (req, res) => {
  res.sendFile(`${__dirname}/views/listener.html`);
});

io.on("connection", socket => {
  console.log("user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("join", (data, fn) => {
    console.log(data, fn);
    socket.join(data.room);
    fn({ status: "ok", room: data.room });
  });

  socket.on("clientData", data => {
    db.update(
      { _id: data.id },
      { $push: { location: data.location } },
      { upsert: true },
      (err, numReplaced, upsert) => {
        // console.log(err, numReplaced, upsert);
      }
    );
    socket.to(data.room).emit("getClientData", data);
  });

  socket.on("getSingleData", (data, fn) => {
    const id = data.id;
    const limit = data.limit;
    getLast({ id, limit })
      .then(locationList => {
        fn({ room: "cars", id: data.id, locationList });
      })
      .catch(e => {
        fn({ error: "Got an error" });
      });
  });
});
