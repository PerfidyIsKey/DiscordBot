const Discord = require('discord.js');
const client = new Discord.Client();

var MongoClient = require('mongodb').MongoClient;


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let prefix = "+"

function addPrefix(command) {
    return prefix + command
}

function roundAmount(credits) {
    credits = Math.round(+credits)
    return credits
}

function IDExtractor(user) {
    let userID = user.replace("<", "")
    userID = userID.replace(">", "")
    userID = userID.replace("@", "")
    userID = userID.replace("!", "")
    return userID
}

function IDEncaser(id) {
    let user = "<@" + id + ">"
    return user
}

function giveMoney(msg, content, db ,dbo) {
    let user = content.split(" ")[0]
    let amount = content.split(" ")[1]
    amount = roundAmount(amount)

    const giveMoneyPromise = new Promise((resolve, reject) => {
        checkCredits(msg.author.id, dbo, amount, resolve, reject)
    })

    giveMoneyPromise.then((result) =>{
        const innerGiveMoneyPromise = new Promise((resolve, reject) => {
            updateCredits(msg.author.id, (amount * -1), db, dbo, resolve, reject)
        })

        innerGiveMoneyPromise.then(() => {
            updateCredits(IDExtractor(user), amount, db, dbo)
            msg.reply("You gave **" + amount + "** credits to " + user + "!")
        })

        innerGiveMoneyPromise.catch(() => {
            msg.reply("Something went wrong trying to give money :(")
        })
    })

    giveMoneyPromise.catch(() => {
        msg.reply("Something went wrong trying to give money :(")
    })
}

function checkCredits(userID, dbo, amount, resolve, reject) {
    let query = { id: userID };

    dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
        if (err) throw err;
        console.log("information gathered.");
        if (!result || !result[0] || !result[0].credits) {
            reject()
            return false
        } else {
            if (+(result[0].credits) >= +amount && +amount > 0) {
                if (resolve) {
                    resolve(true)
                }
                return true
            } else {
                reject()
                return false
            }
        }

    })
}

function updateCredits(userID, amount, db, dbo, outerResolve, outerReject) {
    let query = { id: userID };
    const creditUpdatePromise = new Promise((resolve, reject) => {
        
        dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
            if (err) throw err;
            console.log("information gathered.");
            console.log(result[0])
            if (!result || !result[0] || (!result[0].credits && result[0].credits != 0)) {
                reject()
            } else {
                resolve(result[0].credits)
            }
        })
    })
    creditUpdatePromise.then((credits) => {
        let newvalues = { $set: { credits: (credits + amount)} };
        dbo.collection("DiscordBot1").update(query, newvalues, function (err, res) {
            if (err) throw err
            console.log("1 document updated")
            if(outerResolve){
                outerResolve()
            } else {
                db.close()
            }
        });
    })

    creditUpdatePromise.catch(() =>{
        if(outerReject){
            outerReject()
        } else {
            db.close()
        }
    })
}

function duelWin(winnerID, loserID, amount, db, dbo, msg) {
    const duelWinPromise = new Promise((resolve, reject) => {
        msg.channel.send(IDEncaser(winnerID) + ", You won **" + amount + "** credits from " + IDEncaser(loserID) + "!")
        updateCredits(winnerID, amount, db, dbo, resolve, reject)
    })

    duelWinPromise.then(() => {
        updateCredits(loserID, (amount * -1), db, dbo)
    })

    duelWinPromise.catch(() =>{

    })
}


function performDuel(ID, duelID, amount, db, dbo, msg) {
    let rn = Math.round(Math.random())
    if (rn == 0) {
        duelWin(ID, duelID, amount, db, dbo, msg)
    } else {
        duelWin(duelID, ID, amount, db, dbo, msg)
    }
}

function duelAccept(msg, db, dbo, duelistID) {
    let query = { id: duelistID };
    let duel = false
    let duelTimeOut = 1000 * 60 * 5
    dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
        if (err) throw err;
        console.log("information gathered.");
        if (!result || !result[0] || !result[0].duelPartner || !result[0].duelTime) {
            duel = false
        } else {
            if (result[0].duelPartner == msg.author.id) {
                let now = Date.now()
                if (+now - +(result[0].duelTime) < duelTimeOut) {
                    duel = true
                } else {
                    duel = false
                }
            } else {
                duel = false
            }
        }
        if (duel) {
            performDuel(msg.author.id, duelistID, result[0].duelAmount, db, dbo, msg)
        } else {
            db.close()
        }
    })
}

function duelRequest(msg, db, dbo, player, duel, amount) {
    if (duel) {
        msg.channel.send(player + ", do you accept this challenge?\n Type: " + addPrefix("duel accept " + IDEncaser(msg.author.id)))
        let time = Date.now()
        newvalues = { $set: { duelPartner: IDExtractor(player), duelTime: time, duelAmount: amount } };
        let query = { id: msg.author.id };
        dbo.collection("DiscordBot1").updateOne(query, newvalues, function (err, res) {
            if (err) throw err
            console.log("1 document updated")
            db.close()
        });

    } else {
        msg.reply("The duel could not be requested. Check if you both have enough credits.")
        db.close()
    }
}

function duel(msg, db, dbo, content) {
    let player = content.split(" ")[0]
    let amount = content.split(" ")[1]
    if (player === "accept") {
        duelAccept(msg, db, dbo, IDExtractor(amount))
    } else {
        let playerID = IDExtractor(player)
        let userID = msg.author.id
        if (userID != playerID ) {
            amount = roundAmount(amount)
            const duelPromise = new Promise((resolve, reject) => {
                checkCredits(playerID, dbo, amount, resolve, reject)
            })

            duelPromise.then((result) => {
                const innerPromise = new Promise((resolve, reject) => {
                    checkCredits(userID, dbo, amount, resolve, reject)
                })

                innerPromise.then((innerResult) => {
                    if (result && innerResult) {
                        duelRequest(msg, db, dbo, player, true, amount)
                    } else {
                        duelRequest(msg, db, dbo, player, false, amount)
                    }
                })

                innerPromise.catch(() => {
                    duelRequest(msg, db, dbo, player, false, amount)
                })
            })

            duelPromise.catch(() => {
                duelRequest(msg, db, dbo, player, false, amount)
            })
        }
    }
}

function addDaily(newCredits, msg, result, todayDate, db, dbo, query) {
    
    let streakVal = result[0].dailyStreak

    let streakTimeout = 60 * 60 * 30 * 1000

    let oldDate = result[0].dailyDate

    if(!streakVal || (+todayDate - +oldDate) > streakTimeout) {
        streakVal = 0
    }
    let dailyAmount = 200 + (200 * +streakVal)
    streakVal += 0.1
    newCredits = +(result[0].credits) + dailyAmount

    newvalues = { $set: { credits: newCredits, dailyDate: todayDate, dailyStreak: streakVal } };

    dbo.collection("DiscordBot1").updateOne(query, newvalues, function (err, res) {
        if (err) throw err;
        console.log("1 document updated");
        db.close();
    });

    msg.reply("You have received **" + dailyAmount + "** credits!")
}

function dailyCredits(msg, db, dbo) {
    let query = { id: msg.author.id };

    dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
        if (err) throw err;
        console.log("information gathered.");
        let newCredits = 0
        let todayDate = new Date()

        if (!result || !result[0] || !result[0].dailyDate) {
            if (!result || !result[0]) {
                createNewUser(msg, db, dbo)
            }
            else {
                addDaily(newCredits, msg, result, todayDate, db, dbo, query)
            }

        } else {
            let oldDate = result[0].dailyDate

            let dailyTime = 60 * 60 * 14 * 1000

            if ((+todayDate - +oldDate) > dailyTime) {
                addDaily(newCredits, msg, result, todayDate, db, dbo, query)
            } else {
                msg.reply("Your daily has already been claimed :(")
                db.close();
            }
        }
    })
}

function doCoinFlip(result, content, heads, msg, db, dbo, win, query) {
    let userCredits = result[0].credits
    content = roundAmount(content)
    if (+content <= userCredits && +content > 0) {
        let rn = Math.round(Math.random())
        if (rn == 0 && heads || rn == 1 && !heads) {
            win = true
        }

        let ht
        if (heads) {
            ht = "heads"
        } else {
            ht = "tails"
        }

        //update
        var newvalues = {}
        let credRes = userCredits
        if (win) {
            credRes += +content

            msg.reply('Congratulations!! You chose **' + ht + '** and received **' + content + '** credits!');
        } else {
            credRes -= +content

            msg.reply('Better luck next time! You chose **' + ht + '** and lost **' + content + '** credits!');
        }

        newvalues = { $set: { credits: credRes } };

        dbo.collection("DiscordBot1").updateOne(query, newvalues, function (err, res) {
            if (err) throw err;
            console.log("1 document updated");
            db.close();
        });
    }
    else {
        msg.reply("You don't have sufficient credits.");
    }
}

function createNewUser(msg, db, dbo) {

    let date = new Date()
    var myobj = { name: msg.author.username, id: msg.author.id, credits: 200, dailyDate: date };
    dbo.collection("DiscordBot1").insertOne(myobj, function (err, res) {
        if (err) throw err;
        console.log("1 document inserted.")
        db.close();
        messageHandler(msg)
    })
}

function messageHandler(msg) {
    MongoClient.connect(url, function (err, db) {
        if (err) throw err;
        var dbo = db.db("DiscordBots");

        let commands = ["heads <credits>", "tails <credits>", "credits [@user]", "daily", "duel @user <credits>", "give @user <credits>"]

        let resume = false
        let heads = true
        let content = msg.content
        let win = false

        if (msg.content.startsWith(addPrefix("heads"))) {
            heads = true
            resume = true
            content = content.replace(addPrefix("heads "), "")
        }
        else if (msg.content.startsWith(addPrefix("tails"))) {
            heads = false
            resume = true
            content = content.replace(addPrefix("tails "), "")
        }
        else if (msg.content.startsWith(addPrefix("credits"))) {
            content = content.replace(addPrefix("credits "), "")
            let userID = ""
            let user = ""
            if(content.startsWith("<")){
                userID = IDExtractor(content)
                user = content
            } else {
                userID = msg.author.id
                user = IDEncaser(userID)
            }

            let query = { id: userID };
            //find

            dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
                if (err) throw err;
                console.log("information gathered.");
                if (!result || !result[0]) {
                    createNewUser(msg, db, dbo)
                } else {
                    msg.channel.send(user + ", currently has **" + result[0].credits + "** credits.")
                }
                db.close()
            })

            resume = false
        } else if(msg.content.startsWith(addPrefix("give"))){
            content = content.replace(addPrefix("give "), "")
            giveMoney(msg, content, db ,dbo)

        } else if (msg.content == addPrefix("help")) {
            let reply = "\n"
            for (command of commands) {
                reply += (addPrefix(command) + "\n")
            }

            msg.reply(reply)
            resume = false
            db.close()
        } else if (msg.content == addPrefix("daily")) {
            dailyCredits(msg, db, dbo)
        } else if (msg.content.startsWith(addPrefix("duel"))) {
            content = content.replace(addPrefix("duel "), "")
            duel(msg, db, dbo, content)
        }
        else {
            resume = false
            db.close()
        }

        if (resume) {

            let query = { id: msg.author.id };
            //find
            const dbPromise = new Promise((resolve, reject) => {
                dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
                    if (err) throw err;
                    console.log("information gathered.");
                    if (!result || !result[0]) {
                        reject()
                    } else {
                        resolve(result)

                    }
                });
            });

            dbPromise.then((result) => {
                doCoinFlip(result, content, heads, msg, db, dbo, win, query)
            });

            dbPromise.catch(() => {
                createNewUser(msg, db, dbo)
            })
        }
    })
}

client.on('message', msg => {
    messageHandler(msg)
});

client.on('error', (error) => console.log("Client Error: " + error));



client.login(token);