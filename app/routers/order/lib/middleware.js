var jwt = require('jsonwebtoken');
const middleware = {};
middleware.verifyToken = (req, res, next) => {
    try {
        var token = req.headers.authorization;
        if (!token) {
            return res.reply("true");
        }
        token = token.replace('Bearer ', '');
        jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
            if (err)
                return res.reply(messages.unauthorized());
            if (decoded.role === "user") {
                req.userId = decoded.id;
                req.role = decoded.role;
                req.name = decoded.name;
                req.email = decoded.email;
                next();
            } else
                return res.reply(messages.unauthorized());
        });
    } catch (error) {
        return res.reply(messages.server_error());
    }
}
middleware.verifyWithoutToken = (req, res, next) => {
    try {
        var token = req.headers.authorization;
        if (token && token != undefined && token != '') {
            token = token.replace('Bearer ', '');
            jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
                if (err) {
                    return res.reply(messages.unauthorized());
                }
                req.userId = decoded.id;
                req.role = decoded.role;
                next();
            });
        } else {
            next();
        }
    } catch (error) {
        return res.reply(messages.server_error());
    }
}
module.exports = middleware;