#include <libusb.h>
#include <stdio.h>
#include <unistd.h>
#include <stdint.h>
#include <stdlib.h>
#include <getopt.h>
#include <string.h>
#include <time.h>
#include <signal.h>

#define CMD_MODE 0x03
struct cmd
{
  char *name;
  uint8_t val;
};

const struct cmd commands[] =
    {
        {"VDC", 0xa0},
        {"60mVDC", 0xa1},
        {"600mVDC", 0xa2},
        {"6VDC", 0xa3},
        {"60VDC", 0xa4},
        {"600VDC", 0xa5},
        {"800VDC", 0xa6},
        {"VAC", 0xb0},
        {"60mVAC", 0xb1},
        {"600mVAC", 0xb2},
        {"6VAC", 0xb3},
        {"60VAC", 0xb4},
        {"600VAC", 0xb5},
        {"mADC", 0xc0},
        {"60mADC", 0xc1},
        {"600mADC", 0xc2},
        {"ADC", 0xc3},
        {"mAAC", 0xd0},
        {"60mAAC", 0xd1},
        {"600mAAC", 0xd2},
        {"AAC", 0xd3},
        {"ohm", 0xe0},
        {"600ohm", 0xe1},
        {"6kohm", 0xe2},
        {"60kohm", 0xe3},
        {"600kohm", 0xe4},
        {"6Mohm", 0xe5},
        {"60Mohm", 0xe6},
        {"diode", 0xf0},
        {"cap", 0xf1},
        {"cont", 0xf2},
        //{"cont", 0xf4}, //another possible continuity code.
        //{"rel", 0xf3}, // relative mesurement is selected as a mode.
        {"temp", 0xf5},
        {"tempc", 0xf5},
        {"tempf", 0xf6},
        {"\0\0\0\0\0\0", 0x00} // the last entry must have a null string
};

uint8_t selectCommand(char *cmdName)
{
  const struct cmd *currentCmd;
  int currentEntry = 0;
  do
  {
    currentCmd = &commands[currentEntry];
    if (!strcasecmp(currentCmd->name, cmdName))
    {
      return currentCmd->val;
    }
    currentEntry++;
  } while (currentCmd->name[0]);
  return 0;
}

libusb_device_handle *dev_handle; // a device handle
libusb_context *ctx = NULL;       // a libusb session

int initUsbLibrary()
{
  int r; // for return values

  r = libusb_init(&ctx); // initialize the library for the session we just declared

  if (r < 0)
  {
    fprintf(stderr, "Init Error %d\n", r); // there was an error
    return 1;
  }

  libusb_set_debug(ctx, 3); // set verbosity level to 3, as suggested in the documentation
  return 0;
}

int connectUsbDevice()
{
  int r;                                    // for return values
  libusb_device **devs;                     // pointer to pointer of device, used to retrieve a list of devices
  ssize_t cnt;                              // holding number of devices in list
  cnt = libusb_get_device_list(ctx, &devs); // get the list of devices
  if (cnt < 0)
  {
    fprintf(stderr, "Get Device Error\n"); // there was an error
    return 1;
  }
  fprintf(stdout, "%ld Devices in list.\n", cnt);

  dev_handle = libusb_open_device_with_vid_pid(ctx, 1155, 22306); // these are vendorID and productID I found for my usb device
  libusb_free_device_list(devs, 1);                               // free the list, unref the devices in it
  if (dev_handle == NULL)
  {
    fprintf(stderr, "Cannot open device\n");
    return 1;
  }
  else
  {
    fprintf(stdout, "Device Opened\n");
  }

  int actual; // used to find out how many bytes were written
  if (libusb_kernel_driver_active(dev_handle, 0) == 1)
  { // find out if kernel driver is attached
    fprintf(stdout, "Kernel Driver Active\n");
    if (libusb_detach_kernel_driver(dev_handle, 0) == 0) // detach it
      fprintf(stdout, "Kernel Driver Detached!\n");
  }
  r = libusb_claim_interface(dev_handle, 0); // claim interface 0 (the first) of device (mine had jsut 1)
  if (r < 0)
  {
    fprintf(stderr, "Cannot Claim Interface\n");
    return 2;
  }
  fprintf(stdout, "Claimed Interface\n");

  return 0;
}

int readUsbDevice(unsigned char *buffer, int *actualLen, int maxLen)
{
  return libusb_bulk_transfer(dev_handle, (0x81 | LIBUSB_ENDPOINT_IN), buffer, maxLen, actualLen, 0);
}

int writeUsbDevice(unsigned char *buffer, unsigned int len)
{
  int r;
  int actual;

  r = libusb_bulk_transfer(dev_handle, (0x02 | LIBUSB_ENDPOINT_OUT), buffer, len, &actual, 0);
  if (r != 0 || actual != len)
  {
    return 1;
  }
  return 0;
}

int closeUsbDevice()
{
  int r;
  r = libusb_release_interface(dev_handle, 0); // release the claimed interface

  if (r != 0)
  {
    fprintf(stderr, "Cannot Release Interface\n");
    return 1;
  }
  fprintf(stdout, "Released Interface\n");

  fprintf(stdout, "Closing Handle\n");
  libusb_close(dev_handle); // close the device we opened
  return 0;
}

void closeUsbSession()
{
  fprintf(stdout, "Closing LibUSB\n");
  libusb_exit(ctx);
}

// variables to handle sigterm and gracefully close libusb
volatile sig_atomic_t sigTermReceived = 0;
void handleSigTerm(int signum)
{
  sigTermReceived = 1;
}

unsigned char databuff[64]; // a buffer to hold usb packets.

// some timespecs for nanosleep
const struct timespec ms200 = {0, 200000000};
const struct timespec ms50 = {0, 50000000};

static int relativeFlag = 0x00;
static int verboseFlag = 0x00;

int main(int argc, char **argv)
{

  struct sigaction action;
  memset(&action, 0, sizeof(struct sigaction));
  action.sa_handler = handleSigTerm;
  sigaction(SIGTERM, &action, NULL);

  int c;
  uint8_t selectedMode = 0x00;

  while (1)
  {
    static struct option long_options[] =
        {
            /* These options set a flag. */
            {"verbose", no_argument, &verboseFlag, 1},
            {"relative", no_argument, &relativeFlag, 1},
            {"mode", required_argument, 0, 'm'},
            {0, 0, 0, 0}};
    /* getopt_long stores the option index here. */
    int option_index = 0;

    c = getopt_long(argc, argv, "vrm:",
                    long_options, &option_index);

    /* Detect the end of the options. */
    if (c == -1)
      break;

    switch (c)
    {
    case 0:
      /* If this option set a flag, do nothing else now. */
      break;
    case 'v':
      verboseFlag = 1;
      break;
    case 'r':
      relativeFlag = 1;
      break;
    case 'm':
      selectedMode = selectCommand(optarg);
      if (!selectedMode)
      {
        fprintf(stderr, "\nInvalid mode (%s) selected!\n", optarg);
        fprintf(stderr, "Modes are NOT case sensitive. Valid modes are:\n");

        int currentEntry = 0;
        const struct cmd *currentCmd = &commands[currentEntry];
        do
        {
          fprintf(stderr, "\t* %s\n", currentCmd->name);
          currentEntry++;
          currentCmd = &commands[currentEntry];
        } while (currentCmd->name[0]);
        puts("");
        exit(1);
      }

      break;
    case '?':
      /* getopt_long already printed an error message. */
      break;

    default:
      fprintf(stderr, "\nInvalid short option (-%c).\n", c);
      exit(1);
    }
  }

  /* Print any remaining command line arguments (not options). */
  if (optind < argc)
  {
    printf("non-option ARGV-elements: ");
    while (optind < argc)
      printf("%s ", argv[optind++]);
    putchar('\n');
  }

  if (initUsbLibrary())
  {
    closeUsbSession();
    exit(1);
  }

  int result = connectUsbDevice();
  if (result >= 2)
  {
    closeUsbDevice();
  }
  if (result >= 1)
  {
    fprintf(stderr, "\nUnable to open Hantek Data Logger.  Exiting....\n");
    closeUsbSession();
    exit(1);
  }

  int actual;

  fprintf(stdout, "Selected Mode: %02x\n", selectedMode);
  if (selectedMode)
  {
    int i;

    // we need to cycle one by one to select the required mode.
    for (i = 0; i < 17; i++)
    {
      databuff[0] = CMD_MODE;

      // but not if the mode is 0xf?
      uint8_t currentMode = selectedMode;
      if ((selectedMode & 0xF0) != 0xF0)
      {
        currentMode = ((selectedMode & 0xF0) | (i & 0x0F));
      }

      databuff[1] = currentMode;
      fprintf(stdout, "Writing mode %02x\n", currentMode);

      if (writeUsbDevice(databuff, 2))
      {
        fprintf(stderr, "Write error whilst trying to select mode.\n");
        exit(2);
      }

      if (readUsbDevice(databuff, &actual, 64))
      {
        fprintf(stdout, "Read error trying to select mode.\n");
      }

      if (actual == 1 && databuff[0] == 0xdd)
      {
        nanosleep(&ms50, 0);
        if (currentMode == selectedMode)
        {
          fprintf(stdout, "Mode changed.\n");
          break;
        }
      }
      else
      {
        fprintf(stderr, "ERROR: Mode did not change.\n");
        exit(3);
      }
    }
  }
  else
  {
    fputs("WARNING: No mode selected.  The data logger will remain in whatever mode is already selected.\n", stdout);
  }

  if (relativeFlag)
  {
    fprintf(stdout, "Selecting relative mode....\n");
    databuff[0] = CMD_MODE;

    databuff[1] = 0xf3;

    if (writeUsbDevice(databuff, 2))
    {
      fprintf(stderr, "Write error whilst trying to select relative measurement.\n");
      exit(2);
    }

    if (readUsbDevice(databuff, &actual, 64))
    {
      fprintf(stderr, "Read error trying to select relative measurement.\n");
    }

    if (actual == 1 && databuff[0] == 0xdd)
    {
      fprintf(stdout, "Relative mode selected.\n");
    }
    else
    {
      fprintf(stderr, "ERROR: Could not select relative measurement mode.\n");
      exit(3);
    }
  }

  while (!sigTermReceived)
  {
    // take some readings
    databuff[0] = 0x01;
    databuff[1] = 0x0f; // get reading
    if (writeUsbDevice(databuff, 2))
    {
      closeUsbDevice();
      int i;
      for (i = 0; i < 5; i++)
      {
        fprintf(stdout, "Write error, attempting reconnection.\n");
        nanosleep(&ms200, 0);
        if (!connectUsbDevice())
        {
          if (!writeUsbDevice(databuff, 2))
          {
            break;
          }
          closeUsbDevice();
        }
      }
      if (i == 5)
      {
        fprintf(stderr, "Unable to recover from write error, exiting.\n");
        break;
      }
    }

    result = readUsbDevice(databuff, &actual, 64);
    if (result == 0) // 0 = read success.
    {

      if (databuff[0] != 0xAA) // It is common for the DMM-USB to send a single 0xAA when no data is available.
      {

        int i;
        if (verboseFlag)
        {
          for (i = 0; i < actual; i++)
          {
            fprintf(stdout, "%02x", databuff[i]);
            fprintf(stdout, " ");
          }
        }

        if (databuff[0] == 0xA0 && actual == 15) // All valid readings seem to start with A0 2B, and are encapsulated in a 16 byte packet.
        {

          fprintf(stdout, "#");

          unsigned char sign = databuff[1]; // bit 2 (0x04) is the negative sign, bit 1 (0x02) is the positive sign
          unsigned char acdc = databuff[8]; // AC, DC, ABS, REL
          unsigned char dpos = databuff[7]; // decimal position from the left as an ASCII value representing a bit mask ('1' = 1, '2' = 2, '4' = 3)

          if (sign & 0x04)
          {
            fprintf(stdout, "-");
          }
          else if (sign & 0x02)
          {
            fprintf(stdout, "+");
          }
          else
          {
            fprintf(stdout, "[%02x]", sign);
          }

          for (i = 0; i < 4; i++)
          {
            fprintf(stdout, "%c", databuff[i + 2]);
            if ((dpos - 0x30) >> i == 1)
            {
              fprintf(stdout, ".");
            }
          }

          int beepFlag = 0;

          switch (databuff[10])
          {
          case 0x80:
            fprintf(stdout, " u");
            break;
          case 0x40:
            fprintf(stdout, " m");
            break;
          case 0x20:
            fprintf(stdout, " k");
            break;
          case 0x10:
            fprintf(stdout, " M");
            break;
          case 0x08:
            // beep symbol indicating CONT mode.
            beepFlag = 1;
            fprintf(stdout, " ");
            break;
          default:
            if (databuff[9] & 0x02)
            {
              fprintf(stdout, " n");
            }
            else
            {
              fprintf(stdout, " ");
            }
          }

          switch (databuff[11])
          {
          case 0x01:
            fprintf(stdout, "\xc2\xb0"
                            "F");
            break;
          case 0x02:
            fprintf(stdout, "\xc2\xb0"
                            "C");
            break;
          case 0x04:
            fprintf(stdout, "F");
            break;
          case 0x20:
            fprintf(stdout, "ohms");
            if (beepFlag)
              fprintf(stdout, "\xe2\x99\xab"); // add a beamed eigth note to indicate continuity mode.
            break;
          case 0x40:
            fprintf(stdout, "A");
            break;
          case 0x80:
            fprintf(stdout, "V");
            break;
          default:
            fprintf(stdout, " %02x", databuff[11]);
          }

          if (acdc & 0x08)
            fprintf(stdout, "AC");
          if (acdc & 0x10)
            fprintf(stdout, "DC");
          // if (acdc & 0x01)
          //     fprintf(stdout, ""); // i don't know what this bit is, it is set on volts, amps and ohms, but not temperature, diode, .
          if (acdc & 0x20)
            fprintf(stdout, " AUTO");
          else
            fprintf(stdout, " MANU");

          if (acdc & 0x04)
            fprintf(stdout, " REL");

          fprintf(stdout, "\n");
        }
        else // if databuff[0] == 0xA0
        {
          fprintf(stdout, "%02x\n", databuff[0]);
          nanosleep(&ms200, 0);
        }
      }
      else // if databuff[0] |= 0xAA
      {
        nanosleep(&ms200, 0);
      }
    }
    else // if read success
    {
      fprintf(stderr, "Read error, exiting.\n");
      break;
    }

    fflush(stdout);
  }

  if (closeUsbDevice())
  {
    return 1;
  }

  closeUsbSession();

  return 0;
}
