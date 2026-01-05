# Linux Software for Hantek 365B Datalogger
This repository consists of a small command line application written in C to communicate
with the data logger and an Electron based GUI which gives all of the functionality of
the factory software for Windows.

## How to build (Tested on Ubuntu 16.04LTS)

First make sure you have the dependencies installed.

**For the CLI** you need:
* libusb1.0-dev
* scons (for building)

**For the GUI** you need:
* nodejs
* npm

```
sudo apt install npm libusb-1.0-0-dev scons
cd #to whatever folder you want to unpack in
git clone https://github.com/mp035/hantek-365.git
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

## How to build for Windows (Thanks [trbLeeciN](https://github.com/trbLeeciN))
Things you need;

**Zadig** <https://zadig.akeo.ie/>

Zadig used to change driver of Hantek, since Hantek365 driver can not be used, so we need to change Hantek driver as libusb driver.

**Mingw** <http://www.mingw.org/>

Mingw is C complier. Make sure you install gcc too,
I followed following guide to install Mingw.

<http://www.mingw.org/wiki/howto_install_the_mingw_gcc_compiler_suite>

After these I added path of mingw path as system variable path. I am not sure if it is necessary or not, but I did it and it works. Guide to add path is below, many examples can be found for this.

<https://www.rose-hulman.edu/class/csse/resources/MinGW/installation.htm>

**Libusb Driver** <https://libusb.info/>

Libusb is available in windows as libusb-1.0.dll. You need to download it. And place in the same folder with your .c file.

**Modified .C file**

To compily .c file you need some modifications. I used transfer_main.c file as main and modified it. You can find attached .c file in attachments. (Thanks to CanKoçak)
I will add libusb driver for you in attachments.
Also I will add my exe file, so if you need you can use it. I changed output format since I will use it in another application.
**_So if all installed correctly, you will go to command prompt._**
in cmd: Go to source folder (where .c and .dll file is)
type: gcc -o executable_filepath.exe source_filepath.c -lusb-1.0
If you done everything right you will get .exe file in the same folder. After that you need to change hantek driver by using Zadig and you are ready to go.

[hantek_win.zip](https://github.com/mp035/hantek-365/files/2648732/hantek_win.zip)
