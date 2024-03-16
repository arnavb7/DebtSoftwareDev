const express = require('express');
const bodyParser = require('body-parser');
const {MongoClient} = require('mongodb');
const path = require('path');
const http = require('http');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const emailValidator = require('deep-email-validator');
var serialNumber = require('serial-number');
serialNumber.preferUUID = true;

const oneDay = 1000 * 60 * 60 * 24;
const app = express();
app.set('view-engine', "ejs");
const mongoURI = 'mongodb+srv://borrow:borrow@cluster0.fqwnh.mongodb.net/?retryWrites=true&w=majority';
app.use(cookieParser());
app.use(sessions({
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    saveUninitialized:true,
    //cookie: { maxAge: oneDay },
    resave: true
}));
var initUser;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


async function newUserAuth(client, usn, pwd, mail){
  try{
    const taken = await client.db("Debt").collection("Users").findOne({username: usn});
    const takenMail = await client.db("Debt").collection("Users").findOne({email: mail});
    if((!taken) && (usn != "") && (pwd != "") && (!takenMail) && (mail != "") && (usn!="Users")){
      const payload =  await client.db("Debt").collection("Users").insertOne({
        username: usn,
        password: pwd,
        email: mail,
        totalDebt: 0,
        zscore: 1000,
        friendrequests: []
      });
      client.db("Debt").createCollection(usn);
      return true;
    }
    else{
      return false;
    }
}   
  catch(er){
    console.error(er); 
  }
}

async function userAuth(client, usn, pwd){
  try{
    const username = await client.db("Debt").collection("Users").findOne({username:usn});
    if(username && pwd == username["password"]){
      return true;
    }
    else{
      return false; 
    }
  }
  catch(er){
    console.error(er);
  }
}

async function retrieveUserData(client, usr){ //use this
  const generalKey = await client.db("Debt").collection("Users").findOne({username:usr});
  const specificKey = await (client.db("Debt").collection(usr).find({friend:true})).toArray();
    initUser = {
    user: usr,
    totalDebt: generalKey["totalDebt"],
    zscore: generalKey["zscore"],
    friendDebt: specificKey,
    requestsIn: generalKey["friendrequests"]
  };
  console.log(initUser); //remove
}

async function addFriend(client, usr){
  const exists = await client.db("Debt").collection("Users").findOne({username:usr});
  const theyRequested = await client.db("Debt").collection("Users").findOne({username:initUser.user});
  const alreadyFriend = await (client.db("Debt").collection(initUser.user).find({friend:true})).toArray();
  var friend = false;
  for(let i=0; i < alreadyFriend.length; i++){
    if(alreadyFriend[i].user == usr){
      friend = true;
    }
  }
  if((usr != initUser.user) && (exists) && (!friend)){
    var otherFriendList = exists.friendrequests;
    for(let i=0; i < otherFriendList.length; i++){
      if(initUser.user == otherFriendList[i]){
        console.log("friend not added1");
        return false;
      }
    }
    var yourFriendsList = theyRequested.friendrequests;
    for(let i=0; i < yourFriendsList.length; i++){
      if(usr == yourFriendsList[i]){
        console.log("friend not added2"); //change later to the accept friend function
        return false;
      }
    }
    otherFriendList.push(initUser.user);
    console.log(otherFriendList);
    const sendreq = await client.db("Debt").collection("Users").updateOne({username:usr}, {$set:{friendrequests: otherFriendList}});
  }
  else{
    console.log("friend not added3");
    return false;
  }
}

async function acceptFriend(client, usr, friend){
  var newDebt = 0;
  var alreadyOwed;
  const createInstance = await client.db("Debt").colelction(usr).insertOne({
    friend: true,
    user: friend,
    //if they are accepting friend request and they already owe money then dont set debt to zero (fix later) solution: find all with friend = false, if friend = any of those then newDebt = the current debt that they have and friend = true (updateOne)
    // the issue is that we cant have people start with debt when they just become friends so we might need to make another variable called visible debt so they dont get thrown off.
    debt: newDebt
  });
}

app.get('/', function(req,res) {
 // res.sendFile(path.join(__dirname+'/login.html'));
//
  res.render("friends.ejs");
});

app.post('/home', (req,res) =>{
  //req.session.initUser = initUser;
  res.cookie('name', 'express2', {maxAge: 900000}).send("sent");
  console.log(req.cookies['name']);


});

app.post('/signup', (req,res) =>{
  //res.sendFile(path.join(__dirname+'/signup.html'));
  //res.render("signup.ejs");
res.cookie('name', 'knlknlklj', {maxAge: 900000}).send('cookie set2');
});

app.post('/welcome', (req, res) =>{
  newUserAuth(client, req.body.nusr, req.body.npwd, req.body.nemail).then(conf => {
    if(conf){
      retrieveUserData(client, req.body.nusr);
      //res.sendFile(path.join(__dirname+'/home.html'));
      res.render("home.ejs");
    }
    else{
      //res.sendFile(path.join(__dirname+'/signup.html'));
      res.render("signup.ejs");
    }
  }).catch(er => {
    console.log(er);
  });
  
});

app.post('/requestFriend', (req,res) =>{
  addFriend(client, req.body.fuser);
});

app.post('/friends', (req,res) =>{
  //res.sendFile(path.join(__dirname+'/friends.html'));
  res.render("friends.ejs", {f: req.session.initUser});
});
app.listen(3000, () => {
  console.log("server started on 3000");
});