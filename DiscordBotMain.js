const Discord = require('discord.js');
const client = new Discord.Client();

var MongoClient = require('mongodb').MongoClient;
var url = process.env.MONGO_STRING;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let prefix = "+"

function addPrefix(command) {
    return prefix + command
}

function addDaily(newCredits, msg, result, todayDate, db, dbo, query) {
    let dailyAmount = 200
    newCredits = +(result[0].credits) + dailyAmount

    newvalues = { $set: { credits: newCredits, dailyDate: todayDate } };

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
            addDaily(newCredits, msg, result, todayDate, db, dbo, query)
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
    content = Math.round(+content)
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

        let commands = ["heads <credits>", "tails <credits>", "credits", "daily"]

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
        else if (msg.content == addPrefix("credits")) {

            let query = { id: msg.author.id };
            //find

            dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
                if (err) throw err;
                console.log("information gathered.");
                if (!result || !result[0]) {
                    msg.reply("No data found.")
                } else {
                    msg.reply("You currently have **" + result[0].credits + "** credits.")
                }
                db.close()
            })

            resume = false
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

let token = process.env.DISCORD_BOT_TOKEN

client.login(token);