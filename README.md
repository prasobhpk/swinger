# Swinger

Swinger is a couchapp for creating and showing Presentations. Think Keynote, stored in CouchDB, run via Javascript and Sammy.js.

# About

This was created as a Demo for my talk at jQuery Conf 2009 about Sammy.js, however, its usefulness might outlast my talk. We'll see.

# Requirements

* A running CouchDB server
* [CouchApp](http://github.com/couchapp/couchapp)

# Usage

All you need to do to get up and running after the requirements are installed is:

    $ couchapp push http://localhost:5984/swinger
    
It should print out instructions of where you can view it.

## Acknowledgments

Swinger was greatly inspired by Pat Nakajima's [Slidedown]. 

### Technologies/Projects used

* [Sammy.js](http://code.quirkey.com/sammy) for frontend controller/routing
* [CouchApp](http://github.com/couchapp/couchapp) for hosting the app in CouchDB
* [Aristo CSS](http://github.com/maccman/aristo/tree/master) for base buttons/styles
* [Showdown](http://attacklab.net/showdown/) for Markdown
* [SHJS](http://shjs.sourceforge.net/) for Code higlighting