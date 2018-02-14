# Linux Software for Hantek 365B Datalogger
This repository consists of a small command line application written in C to communicate
with the data logger and an Electron based GUI which gives all of the functionality of
the factory software for Windows.

## How to build (Tested on Ubuntu 16.04LTS)

First make sure you have the dependencies installed.

**For the CLI** you need:
*libusb1.0-dev
*scons (for building)

**For the GUI** you need:
*nodejs
*npm

```
sudo apt install npm libusb-1.0-0-dev scons
cd #to whatever folder you want to unpack in
git clone git@github.com:mp035/hantek-365.git
cd hantek-365
cd cli
scons
sudo cp 49-hantek.rules /etc/udev/rules.d
sudo service udev restart
cd ../gui
npm install
npm start
```
Plug in your Hantek and click the run button and you should be on your way.


## If you have trouble
Go to the cli folder in the project and execute ./hantek with the datalogger connected and powered up.
The CLI application should report any issues connecting to your device.
